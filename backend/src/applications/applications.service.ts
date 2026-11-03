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
import { ageDescription } from '../common/utils/age.util';
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

const SECTION_ERROR_LIMIT = 5;
type SectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINALIZED';
type SectionFinalizedReason = 'ALL_ITEMS_ANSWERED' | 'ERROR_LIMIT';

function deriveSectionState(
  answers: Array<{ isCorrect: boolean | null; childAnswer: string | null; responseTimeMs: number | null }>,
  totalItems: number,
): { status: SectionStatus; finalizedReason: SectionFinalizedReason | null; consecutiveErrors: number } {
  let consecutiveErrors = 0;
  let answeredCount = 0;

  for (const answer of answers) {
    const answered =
      answer.isCorrect !== null ||
      (answer.childAnswer !== null && answer.childAnswer !== '') ||
      answer.responseTimeMs !== null;
    if (answered) answeredCount += 1;

    if (answer.isCorrect === false) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= SECTION_ERROR_LIMIT) {
        return {
          status: 'FINALIZED',
          finalizedReason: 'ERROR_LIMIT',
          consecutiveErrors: SECTION_ERROR_LIMIT,
        };
      }
    } else {
      consecutiveErrors = 0;
    }
  }

  if (totalItems > 0 && answeredCount === totalItems) {
    return { status: 'FINALIZED', finalizedReason: 'ALL_ITEMS_ANSWERED', consecutiveErrors: 0 };
  }
  return {
    status: answeredCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
    finalizedReason: null,
    consecutiveErrors,
  };
}

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

  private async ensureSections(applicationStepId: string, stepNumber: number) {
    const protocolStep = (await this.protocolService.listSteps()).find(
      (step) => step.stepNumber === stepNumber,
    );
    if (!protocolStep) return null;

    const existingCount = await this.prisma.applicationSection.count({
      where: { applicationStepId },
    });
    await this.prisma.applicationSection.createMany({
      data: protocolStep.substeps.map((substep) => ({
        applicationStepId,
        substepOrder: substep.order,
        status: 'NOT_STARTED',
      })),
      skipDuplicates: true,
    });
    if (existingCount === 0) {
      await this.syncSectionStates(applicationStepId, protocolStep);
    }
    return protocolStep;
  }

  private async assertSectionOpen(
    applicationStepId: string,
    protocolStep: Awaited<ReturnType<ProtocolService['listSteps']>>[number] | null,
    itemNumber: number,
  ) {
    if (!protocolStep) return;
    let globalItemNumber = 0;
    for (const substep of protocolStep.substeps) {
      const first = globalItemNumber + 1;
      globalItemNumber += substep.items.length;
      if (itemNumber < first || itemNumber > globalItemNumber) continue;

      const section = await this.prisma.applicationSection.findUnique({
        where: {
          applicationStepId_substepOrder: {
            applicationStepId,
            substepOrder: substep.order,
          },
        },
      });
      // Seção reaberta para revisão aceita correção, mesmo finalizada.
      if (section?.status === 'FINALIZED' && !section.reopenedAt) {
        throw new ForbiddenException('Esta seção já foi finalizada nesta aplicação.');
      }
      return;
    }
  }

  private async syncSectionStates(
    applicationStepId: string,
    protocolStep: Awaited<ReturnType<ProtocolService['listSteps']>>[number] | null,
  ) {
    if (!protocolStep) return;
    const [sections, savedItems] = await Promise.all([
      this.prisma.applicationSection.findMany({ where: { applicationStepId } }),
      this.prisma.applicationItem.findMany({
        where: { applicationStepId },
        orderBy: { itemNumber: 'asc' },
        select: { itemNumber: true, isCorrect: true, childAnswer: true, responseTimeMs: true },
      }),
    ]);
    const sectionByOrder = new Map(sections.map((section) => [section.substepOrder, section]));
    const itemByNumber = new Map(savedItems.map((item) => [item.itemNumber, item]));
    let globalItemNumber = 0;

    for (const substep of protocolStep.substeps) {
      const answers = substep.items.map(() => itemByNumber.get(++globalItemNumber) ?? {
        isCorrect: null,
        childAnswer: null,
        responseTimeMs: null,
      });
      const current = sectionByOrder.get(substep.order);
      // Uma seção finalizada não é recalculada — exceto em revisão, onde as
      // respostas podem mudar e o estado precisa acompanhar.
      if (current?.status === 'FINALIZED' && !current.reopenedAt) continue;

      const derived = deriveSectionState(answers, substep.items.length);
      const now = new Date();
      await this.prisma.applicationSection.upsert({
        where: {
          applicationStepId_substepOrder: {
            applicationStepId,
            substepOrder: substep.order,
          },
        },
        create: {
          applicationStepId,
          substepOrder: substep.order,
          status: derived.status,
          finalizedReason: derived.finalizedReason,
          consecutiveErrors: derived.consecutiveErrors,
          ...(derived.status !== 'NOT_STARTED' ? { startedAt: now } : {}),
          ...(derived.status === 'FINALIZED' ? { finalizedAt: now } : {}),
        },
        update: {
          status: derived.status,
          finalizedReason: derived.finalizedReason,
          consecutiveErrors: derived.consecutiveErrors,
          ...(derived.status !== 'NOT_STARTED' && !current?.startedAt ? { startedAt: now } : {}),
          finalizedAt: derived.status === 'FINALIZED' ? now : null,
        },
      });
    }
  }

  private async ensureSectionsForApplication(applicationId: string) {
    const protocolSteps = await this.protocolService.listSteps();
    const applicationSteps = await this.prisma.applicationStep.findMany({
      where: { applicationId },
      select: { id: true, stepNumber: true },
    });
    for (const applicationStep of applicationSteps) {
      const protocolStep = protocolSteps.find((step) => step.stepNumber === applicationStep.stepNumber);
      if (protocolStep) {
        await this.ensureSections(applicationStep.id, applicationStep.stepNumber);
      }
    }
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
      substeps?: {
        order: number;
        maxScore?: number | null;
        items: { isPending?: boolean }[];
      }[];
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
            sections: {
              create: (step.substeps ?? []).map((substep) => ({
                substepOrder: substep.order,
                status: 'NOT_STARTED',
              })),
            },
          })),
        },
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: { sections: { orderBy: { substepOrder: 'asc' } } },
        },
      },
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
    await this.ensureSectionsForApplication(id);
    const full = await this.prisma.application.findUnique({
      where: { id },
      include: {
        child: true,
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            items: { orderBy: { itemNumber: 'asc' } },
            sections: { orderBy: { substepOrder: 'asc' } },
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
    const protocolStep = await this.ensureSections(step.id, stepNumber);
    await this.assertSectionOpen(step.id, protocolStep, dto.itemNumber);

    const item = await this.prisma.applicationItem.upsert(
      this.itemUpsertArgs(step.id, dto),
    );

    // autosave: atualiza a etapa e o estado persistido da seção desta sessão.
    const updatedStep = await this.recomputeStepScore(step.id, stepNumber);
    await this.syncSectionStates(step.id, protocolStep);
    const sections = await this.prisma.applicationSection.findMany({
      where: { applicationStepId: step.id },
      orderBy: { substepOrder: 'asc' },
    });
    return { item, step: updatedStep, sections };
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
    const protocolStep = await this.ensureSections(step.id, stepNumber);
    for (const item of dto.items) {
      await this.assertSectionOpen(step.id, protocolStep, item.itemNumber);
    }

    // Regravar item idêntico empurra o updatedAt e estraga a data da última
    // resposta da seção: ao abrir a tela o autosave reenvia tudo que já estava
    // salvo. Só vai ao banco o que de fato mudou.
    const existing = await this.prisma.applicationItem.findMany({
      where: {
        applicationStepId: step.id,
        itemNumber: { in: dto.items.map((item) => item.itemNumber) },
      },
    });
    const existingByNumber = new Map(existing.map((item) => [item.itemNumber, item]));
    const changed = dto.items.filter((item: SaveStepItemDto) => {
      const current = existingByNumber.get(item.itemNumber);
      if (!current) return true;
      const { update } = this.itemUpsertArgs(step.id, item);
      return Object.entries(update).some(
        ([field, value]) => (current as Record<string, unknown>)[field] !== value,
      );
    });

    if (changed.length > 0) {
      await this.prisma.$transaction(
        changed.map((item: SaveStepItemDto) =>
          this.prisma.applicationItem.upsert(this.itemUpsertArgs(step.id, item)),
        ),
      );
    }
    const items = await this.prisma.applicationItem.findMany({
      where: {
        applicationStepId: step.id,
        itemNumber: { in: dto.items.map((item) => item.itemNumber) },
      },
      orderBy: { itemNumber: 'asc' },
    });

    const updatedStep = await this.recomputeStepScore(step.id, stepNumber);
    await this.syncSectionStates(step.id, protocolStep);
    const sections = await this.prisma.applicationSection.findMany({
      where: { applicationStepId: step.id },
      orderBy: { substepOrder: 'asc' },
    });
    return { items, step: updatedStep, sections };
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
      select: { startedAt: true, status: true },
    });
    return this.prisma.applicationStep.update({
      where: { id: applicationStepId },
      data: {
        score,
        // Uma etapa concluída não volta a ficar em andamento. Este
        // recálculo roda a cada autosave, então sem a guarda qualquer
        // gravação posterior rebaixava o status e a conclusão se perdia.
        status:
          current?.status === 'COMPLETED'
            ? 'COMPLETED'
            : hasData
              ? 'IN_PROGRESS'
              : 'NOT_STARTED',
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
      // Finalizar a aplicação encerra as revisões em aberto: as seções
      // voltam a recusar gravação até alguém reabri-las de novo.
      this.prisma.applicationSection.updateMany({
        where: { applicationStep: { applicationId: id }, reopenedAt: { not: null } },
        data: { reopenedAt: null },
      }),
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

  /**
   * Destrava uma seção finalizada para revisão, sem apagar resposta alguma.
   *
   * O status continua FINALIZED — o progresso e o resultado não mudam por
   * reabrir. O que muda é `reopenedAt`, que libera a gravação dos itens
   * daquela seção. `complete()` limpa a marca de todas elas.
   */
  async reopenSection(
    userId: string,
    id: string,
    stepNumber: number,
    substepOrder: number,
  ) {
    await this.ensureOwned(userId, id);
    const step = await this.prisma.applicationStep.findFirst({
      where: { applicationId: id, stepNumber },
      select: { id: true },
    });
    if (!step) {
      throw new NotFoundException('Etapa não encontrada nesta aplicação.');
    }
    const section = await this.prisma.applicationSection.findUnique({
      where: {
        applicationStepId_substepOrder: {
          applicationStepId: step.id,
          substepOrder,
        },
      },
    });
    if (!section) {
      throw new NotFoundException('Seção não encontrada nesta aplicação.');
    }
    if (section.reopenedAt) return section;
    return this.prisma.applicationSection.update({
      where: { id: section.id },
      data: { reopenedAt: new Date() },
    });
  }

  async reopen(userId: string, id: string) {
    const app = await this.ensureOwned(userId, id);
    if (app.status !== 'COMPLETED' && app.status !== 'ARCHIVED') {
      throw new BadRequestException(
        'Apenas aplicações finalizadas podem ser reabertas.',
      );
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          completedAt: null,
          totalScore: null,
          classification: null,
        },
      }),
      this.prisma.applicationSection.updateMany({
        where: {
          applicationStep: { applicationId: id },
          status: 'FINALIZED',
        },
        data: {
          status: 'IN_PROGRESS',
          finalizedReason: null,
          consecutiveErrors: 0,
          finalizedAt: null,
        },
      }),
    ]);
    return updated;
  }

  async result(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.ensureSectionsForApplication(id);
    const full = await this.prisma.application.findUnique({
      where: { id },
      include: {
        child: true,
        steps: {
          orderBy: { stepNumber: 'asc' },
          include: {
            items: { orderBy: { itemNumber: 'asc' } },
            sections: { orderBy: { substepOrder: 'asc' } },
          },
        },
      },
    });
    if (!full) throw new NotFoundException('Aplicação não encontrada.');

    const protocol = await this.protocolService.listSteps();
    const stepResults = full.steps.map((s) => {
      const timerMs =
        s.stepNumber === TIMER_STEP
          ? s.items.reduce(
              (acc, i) => acc + (i.responseTimeMs ?? 0),
              0,
            ) || null
          : null;
      const progress = this.progressForStep(
        protocol.find((step) => step.stepNumber === s.stepNumber),
        s.items,
      );
      const answeredItems = progress
        ? progress.substeps.reduce((acc, sub) => acc + sub.answeredItems, 0)
        : s.items.length;
      return {
        stepNumber: s.stepNumber,
        skill: s.skill,
        status: s.status,
        score: s.score,
        maxScore: s.maxScore,
        completedAt: s.completedAt?.toISOString() ?? null,
        timerMs,
        answeredItems,
        totalItems: progress?.totalItems ?? s.items.length,
        notes: s.notes,
        items: s.items.map((i) => ({
          itemNumber: i.itemNumber,
          prompt: i.prompt,
          expectedAnswer: i.expectedAnswer,
          childAnswer: i.childAnswer,
          isCorrect: i.isCorrect,
          notes: i.notes,
        })),
        substeps: progress?.substeps.map((substep) => {
          const section = s.sections.find((candidate) => candidate.substepOrder === substep.order);
          return {
            ...substep,
            status: section?.status ?? 'NOT_STARTED',
            finalizedReason: section?.finalizedReason ?? null,
            consecutiveErrors: section?.consecutiveErrors ?? 0,
          };
        }) ?? [],
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
        age: ageDescription(full.child.birthDate),
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

  /**
   * Cruza o protocolo com as respostas já gravadas.
   *
   * O número do item na aplicação é a ordem da prova na etapa (sem os
   * exemplos). Os exemplos aparecem à parte e não entram em respondidos,
   * acertos ou pontuação.
   */
  private progressForStep(
    protocolStep:
      | {
          substeps: Array<{
            order: number;
            title: string;
            trainingExamples: string[];
            items: Array<{
              prompt: string | null;
              expectedAnswer: string | null;
            }>;
          }>;
        }
      | undefined,
    saved: Array<{
      itemNumber: number;
      prompt: string | null;
      expectedAnswer: string | null;
      childAnswer: string | null;
      isCorrect: boolean | null;
      responseTimeMs: number | null;
      notes: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    }>,
  ) {
    if (!protocolStep) return null;
    const savedByNumber = new Map(saved.map((item) => [item.itemNumber, item]));
    let global = 0;
    const substeps = protocolStep.substeps.map((sub) => {
      const examples = sub.trainingExamples.map((raw, index) => this.exampleView(raw, index));
      const items = sub.items.map((item, index) => {
        global += 1;
        const answer = savedByNumber.get(global);
        const answered = Boolean(
          answer &&
            (answer.isCorrect === true ||
              answer.isCorrect === false ||
              (answer.childAnswer != null && answer.childAnswer !== '') ||
              answer.responseTimeMs != null),
        );
        return {
          itemNumber: index + 1,
          prompt: answer?.prompt ?? item.prompt,
          expectedAnswer: answer?.expectedAnswer ?? item.expectedAnswer,
          childAnswer: answered ? answer?.childAnswer ?? null : null,
          isCorrect: answered ? answer?.isCorrect ?? null : null,
          answered,
          notes: answer?.notes ?? null,
          // Guardadas para datar a seção: a linha do item nasce no primeiro
          // salvamento daquela resposta e é tocada a cada correção.
          createdAt: answered ? answer?.createdAt ?? null : null,
          updatedAt: answered ? answer?.updatedAt ?? null : null,
        };
      });

      // Quando a seção foi respondida: da primeira resposta registrada à
      // última mexida. Sem resposta nenhuma, as duas ficam nulas.
      const answeredTimes = items.filter((item) => item.answered);
      const firstAnswerAt = answeredTimes
        .map((item) => item.createdAt)
        .filter((at): at is Date => at != null)
        .reduce<Date | null>((min, at) => (min == null || at < min ? at : min), null);
      const lastAnswerAt = answeredTimes
        .map((item) => item.updatedAt)
        .filter((at): at is Date => at != null)
        .reduce<Date | null>((max, at) => (max == null || at > max ? at : max), null);
      return {
        order: sub.order,
        title: sub.title,
        exampleCount: examples.length,
        examples,
        totalItems: items.length,
        answeredItems: items.filter((item) => item.answered).length,
        correctItems: items.filter((item) => item.isCorrect === true).length,
        wrongItems: items.filter((item) => item.isCorrect === false).length,
        firstAnswerAt: firstAnswerAt?.toISOString() ?? null,
        lastAnswerAt: lastAnswerAt?.toISOString() ?? null,
        items: items.map(({ createdAt: _c, updatedAt: _u, ...item }) => item),
      };
    });
    return {
      totalItems: substeps.reduce((acc, sub) => acc + sub.totalItems, 0),
      substeps,
    };
  }

  private exampleView(raw: string, index: number) {
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return { label: parts[0] || `Exemplo ${index + 1}`, detail: parts[1] };
    }
    const head = raw.split(':')[0]?.trim();
    return { label: head || `Exemplo ${index + 1}`, detail: null };
  }
}