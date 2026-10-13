import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Application } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChildrenService } from '../children/children.service';
import { ProtocolService } from '../protocol/protocol.service';
import { sanitizeOptional } from '../common/utils/sanitize.util';
import {
  CompleteApplicationDto,
  CreateApplicationDto,
  SaveStepItemDto,
  SaveStepItemsDto,
  UpdateApplicationDto,
  UpdateStepDto,
} from './dto/applications.dto';

export const STEP_COUNT = 5;
export const TIMER_STEP = 3;

const DEFAULT_STEPS: Array<{ stepNumber: number; skill: string; maxScore: number | null }> = [
  { stepNumber: 1, skill: 'conhecimento_alfabeto', maxScore: 23 },
  { stepNumber: 2, skill: 'habilidades_metafonologicas', maxScore: 84 },
  { stepNumber: 3, skill: 'memoria_operacional_fonologica', maxScore: 24 },
  { stepNumber: 4, skill: 'nomeacao_automatica_rapida', maxScore: null },
  { stepNumber: 5, skill: 'compreensao_auditiva_sentencas', maxScore: 20 },
];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childrenService: ChildrenService,
    private readonly protocolService: ProtocolService,
  ) {}

  // ---------- ownership / guards ----------

  async ensureOwned(userId: string, id: string): Promise<Application> {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Aplicação não encontrada.');
    if (app.evaluatorId !== userId) {
      throw new ForbiddenException('Acesso negado a dados de outro avaliador.');
    }
    return app;
  }

  private assertEditable(app: Application) {
    if (app.status === 'COMPLETED' || app.status === 'ARCHIVED') {
      throw new ForbiddenException(
        'Esta aplicação está finalizada. Use a ação de reabertura para editá-la.',
      );
    }
  }

  private async getStep(appId: string, stepNumber: number) {
    const step = await this.prisma.applicationStep.findFirst({
      where: { applicationId: appId, stepNumber },
    });
    if (!step) {
      throw new BadRequestException(`Etapa ${stepNumber} não encontrada.`);
    }
    return step;
  }

  // ---------- criação / listagem ----------

  async create(userId: string, dto: CreateApplicationDto) {
    await this.childrenService.ensureOwned(userId, dto.childId);
    const protocolSteps = await this.protocolService.listSteps();
    const steps: Array<{
      stepNumber: number;
      skill: string;
      maxScore?: number | null;
      timerRequired?: boolean;
      substeps?: { maxScore?: number | null; items: { isPending?: boolean }[] }[];
    }> = protocolSteps.length > 0 ? protocolSteps : DEFAULT_STEPS;

    const app = await this.prisma.application.create({
      data: {
        childId: dto.childId,
        evaluatorId: userId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        currentStep: 1,
        notes: sanitizeOptional(dto.notes),
        steps: {
          create: steps.map((step) => ({
            stepNumber: step.stepNumber,
            skill: step.skill,
            maxScore: step.timerRequired ? null : this.stepMaxScoreFromProtocol(step),
            status: 'NOT_STARTED',
          })),
        },
      },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    return app;
  }

  private stepMaxScoreFromProtocol(step: {
    stepNumber: number;
    maxScore?: number | null;
    timerRequired?: boolean;
    substeps?: { maxScore?: number | null; items: { isPending?: boolean }[] }[];
  }): number | null {
    if (step.stepNumber === TIMER_STEP) return null;
    const substeps = step.substeps ?? [];
    const declared = substeps.reduce((acc, s) => acc + (s.maxScore ?? 0), 0);
    if (declared > 0) return declared;
    const items = substeps.reduce(
      (acc, s) => acc + s.items.filter((i) => !i.isPending).length,
      0,
    );
    return items > 0 ? items : step.maxScore ?? null;
  }

  async findAll(userId: string, query: { status?: string }) {
    const apps = await this.prisma.application.findMany({
      where: {
        evaluatorId: userId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      include: {
        child: {
          select: {
            id: true,
            name: true,
            birthDate: true,
            ageAtEvaluation: true,
          },
        },
      },
    });
    return apps.map((a) => ({
      ...a,
      startedAt: a.startedAt.toISOString(),
      completedAt: a.completedAt?.toISOString() ?? null,
      child: {
        ...a.child,
        birthDate: a.child.birthDate.toISOString(),
      },
    }));
  }

  async findOne(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    const full = await this.prisma.application.findUnique({
      where: { id },
      include: {
        child: true,
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            items: { orderBy: { itemNumber: 'asc' } },
          },
        },
      },
    });
    return {
      ...full,
      startedAt: full!.startedAt.toISOString(),
      completedAt: full!.completedAt?.toISOString() ?? null,
      child: {
        ...full!.child,
        birthDate: full!.child.birthDate.toISOString(),
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto) {
    const app = await this.ensureOwned(userId, id);
    this.assertEditable(app);
    return this.prisma.application.update({
      where: { id },
      data: {
        ...(dto.currentStep ? { currentStep: dto.currentStep } : {}),
        ...(dto.notes !== undefined
          ? { notes: sanitizeOptional(dto.notes) }
          : {}),
      },
    });
  }

  // ---------- itens (autosave) ----------

  async saveItem(
    userId: string,
    id: string,
    stepNumber: number,
    dto: SaveStepItemDto,
  ) {
    const app = await this.ensureOwned(userId, id);
    this.assertEditable(app);
    const step = await this.getStep(id, stepNumber);

    const item = await this.prisma.applicationItem.upsert(
      this.itemUpsertArgs(step.id, dto),
    );

    // autosave: marca a etapa como em andamento e recalcula a pontuação
    const updatedStep = await this.recomputeStepScore(step.id, stepNumber);
    return { item, step: updatedStep };
  }

  /**
   * Monta os argumentos do upsert de um item.
   *
   * Compartilhado por saveItem e saveItems para que a sanitização e o
   * cálculo da pontuação não possam divergir entre os dois caminhos.
   */
  private itemUpsertArgs(applicationStepId: string, dto: SaveStepItemDto) {
    const childAnswer = sanitizeOptional(dto.childAnswer);
    const prompt = sanitizeOptional(dto.prompt);
    const expectedAnswer = sanitizeOptional(dto.expectedAnswer);
    const notes = sanitizeOptional(dto.notes);

    const isCorrect =
      dto.isCorrect === true || dto.isCorrect === false ? dto.isCorrect : null;
    const score =
      dto.score !== undefined
        ? dto.score
        : isCorrect === true
          ? 1
          : isCorrect === false
            ? 0
            : 0;

    return {
      where: {
        applicationStepId_itemNumber: {
          applicationStepId,
          itemNumber: dto.itemNumber,
        },
      },
      create: {
        applicationStepId,
        itemNumber: dto.itemNumber,
        prompt,
        expectedAnswer,
        childAnswer,
        isCorrect,
        score,
        responseTimeMs: dto.responseTimeMs ?? null,
        notes,
      },
      update: {
        ...(prompt !== undefined ? { prompt } : {}),
        ...(expectedAnswer !== undefined ? { expectedAnswer } : {}),
        ...(childAnswer !== undefined ? { childAnswer } : {}),
        isCorrect,
        score,
        ...(dto.responseTimeMs !== undefined
          ? { responseTimeMs: dto.responseTimeMs }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    };
  }

  /**
   * Grava várias respostas numa única requisição.
   *
   * Salvar item a item custava uma ida e volta de rede por item (~255ms
   * medidos), e a navegação aguardava todas antes de trocar de etapa.
   * Aqui a verificação de posse, a busca da etapa e o recálculo da
   * pontuação acontecem uma vez só, e os upserts vão numa transação.
   */
  async saveItems(
    userId: string,
    id: string,
    stepNumber: number,
    dto: SaveStepItemsDto,
  ) {
    const app = await this.ensureOwned(userId, id);
    this.assertEditable(app);
    const step = await this.getStep(id, stepNumber);

    const items = await this.prisma.$transaction(
      dto.items.map((item: SaveStepItemDto) =>
        this.prisma.applicationItem.upsert(this.itemUpsertArgs(step.id, item)),
      ),
    );

    const updatedStep = await this.recomputeStepScore(step.id, stepNumber);
    return { items, step: updatedStep };
  }

  private async recomputeStepScore(applicationStepId: string, _stepNumber: number) {
    const agg = await this.prisma.applicationItem.aggregate({
      where: { applicationStepId },
      _sum: { score: true },
      _count: true,
    });
    const score = agg._sum.score ?? 0;
    const hasData = agg._count > 0;
    const current = await this.prisma.applicationStep.findUnique({
      where: { id: applicationStepId },
      select: { startedAt: true },
    });
    return this.prisma.applicationStep.update({
      where: { id: applicationStepId },
      data: {
        score,
        status: hasData ? 'IN_PROGRESS' : 'NOT_STARTED',
        ...(hasData && !current?.startedAt ? { startedAt: new Date() } : {}),
      },
    });
  }

  async updateStep(
    userId: string,
    id: string,
    stepNumber: number,
    dto: UpdateStepDto,
  ) {
    const app = await this.ensureOwned(userId, id);
    this.assertEditable(app);
    const step = await this.getStep(id, stepNumber);
    return this.prisma.applicationStep.update({
      where: { id: step.id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined
          ? { notes: sanitizeOptional(dto.notes) }
          : {}),
        ...(dto.status === 'COMPLETED'
          ? { completedAt: new Date() }
          : dto.status === 'IN_PROGRESS' && !step.startedAt
            ? { startedAt: new Date() }
            : {}),
      },
    });
  }

  // ---------- finalização / reabertura / resultado ----------

  async complete(
    userId: string,
    id: string,
    dto: CompleteApplicationDto,
  ) {
    const app = await this.ensureOwned(userId, id);
    if (app.status === 'COMPLETED') {
      throw new BadRequestException('Esta aplicação já foi finalizada.');
    }
    if (app.status === 'ARCHIVED') {
      throw new BadRequestException('Esta aplicação está arquivada.');
    }

    const steps = await this.prisma.applicationStep.findMany({
      where: { applicationId: id },
      orderBy: { stepNumber: 'asc' },
      include: { items: true },
    });

    const incomplete = this.findIncompleteSteps(steps);
    if (incomplete.length > 0 && !dto.confirmIncomplete) {
      throw new BadRequestException({
        message: 'Existem etapas obrigatórias incompletas.',
        errors: incomplete.map((s) => ({
          stepNumber: s.stepNumber,
          skill: s.skill,
          reason:
            s.stepNumber === TIMER_STEP
              ? 'Tempo da nomeação automática rápida não registrado.'
              : s.items.length === 0
                ? 'Nenhuma resposta registrada.'
                : 'Etapa não marcada como concluída.',
        })),
      });
    }

    const totalScore = steps
      .filter((s) => s.stepNumber !== TIMER_STEP)
      .reduce((acc, s) => acc + (s.score ?? 0), 0);
    const classification = await this.protocolService.classify(totalScore);

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          totalScore,
          classification,
        },
      }),
      ...steps.map((s) =>
        this.prisma.applicationStep.update({
          where: { id: s.id },
          data: { status: 'COMPLETED', completedAt: now },
        }),
      ),
    ]);

    return this.result(userId, id);
  }

  private findIncompleteSteps(steps: {
    stepNumber: number;
    skill: string;
    status: string;
    items: { responseTimeMs: number | null }[];
  }[]) {
    return steps.filter((s) => {
      if (s.status === 'COMPLETED') return false;
      if (s.stepNumber === TIMER_STEP) {
        return !s.items.some((i) => i.responseTimeMs != null);
      }
      return s.items.length === 0 || s.status !== 'COMPLETED';
    });
  }

  async reopen(userId: string, id: string) {
    const app = await this.ensureOwned(userId, id);
    if (app.status !== 'COMPLETED' && app.status !== 'ARCHIVED') {
      throw new BadRequestException(
        'Apenas aplicações finalizadas podem ser reabertas.',
      );
    }
    return this.prisma.application.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        completedAt: null,
        totalScore: null,
        classification: null,
      },
    });
  }

  async result(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    const full = await this.prisma.application.findUnique({
      where: { id },
      include: {
        child: true,
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            items: { orderBy: { itemNumber: 'asc' } },
          },
        },
      },
    });
    if (!full) throw new NotFoundException('Aplicação não encontrada.');

    const stepResults = full.steps.map((s) => {
      const timerMs =
        s.stepNumber === TIMER_STEP
          ? s.items.reduce(
              (acc, i) => acc + (i.responseTimeMs ?? 0),
              0,
            ) || null
          : null;
      return {
        stepNumber: s.stepNumber,
        skill: s.skill,
        status: s.status,
        score: s.score,
        maxScore: s.maxScore,
        completedAt: s.completedAt?.toISOString() ?? null,
        timerMs,
        answeredItems: s.items.length,
        notes: s.notes,
        items: s.items.map((i) => ({
          itemNumber: i.itemNumber,
          prompt: i.prompt,
          expectedAnswer: i.expectedAnswer,
          childAnswer: i.childAnswer,
          isCorrect: i.isCorrect,
          notes: i.notes,
        })),
      };
    });

    const maxScore = full.steps
      .filter((s) => s.stepNumber !== TIMER_STEP)
      .reduce((acc, s) => acc + (s.maxScore ?? 0), 0);

    return {
      applicationId: full.id,
      status: full.status,
      startedAt: full.startedAt.toISOString(),
      completedAt: full.completedAt?.toISOString() ?? null,
      currentStep: full.currentStep,
      totalScore: full.totalScore,
      maxScore,
      classification: full.classification,
      notes: full.notes,
      child: {
        id: full.child.id,
        name: full.child.name,
        birthDate: full.child.birthDate.toISOString(),
        ageAtEvaluation: full.child.ageAtEvaluation,
        school: full.child.school,
        grade: full.child.grade,
      },
      steps: stepResults,
    };
  }

  async history(userId: string, childId: string) {
    const child = await this.childrenService.ensureOwned(userId, childId);
    const apps = await this.prisma.application.findMany({
      where: { childId, evaluatorId: userId },
      orderBy: { startedAt: 'desc' },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: { items: true },
        },
      },
    });
    return { ...child, applications: apps };
  }
}