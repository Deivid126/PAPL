import { Injectable } from '@nestjs/common';
import { ClassificationConfig } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProtocolService {
  constructor(private readonly prisma: PrismaService) {}

  async listSteps() {
    const steps = await this.prisma.protocolStep.findMany({
      orderBy: { stepNumber: 'asc' },
      include: {
        substeps: {
          orderBy: { order: 'asc' },
          include: {
            items: {
              orderBy: { itemNumber: 'asc' },
              select: {
                id: true,
                itemNumber: true,
                prompt: true,
                expectedAnswer: true,
                imageKey: true,
                isPending: true,
                responseType: true,
              },
            },
          },
        },
      },
    });
    return steps.map((step) => ({
      ...step,
      substeps: step.substeps.map((s) => ({
        ...s,
        trainingExamples: s.trainingExamples
          ? (JSON.parse(s.trainingExamples) as string[])
          : [],
      })),
    }));
  }

  async getStep(stepNumber: number) {
    const steps = await this.listSteps();
    return steps.find((s) => s.stepNumber === stepNumber) ?? null;
  }

  async stepMaxScore(stepNumber: number): Promise<number | null> {
    const step = await this.prisma.protocolStep.findUnique({
      where: { stepNumber },
      include: {
        substeps: { include: { items: true } },
      },
    });
    if (!step) return null;
    if (step.timerRequired) return null;
    // Prioriza o máximo declarado nas subetapas (fonte: protocolo).
    const declared = step.substeps.reduce(
      (acc, s) => acc + (s.maxScore ?? 0),
      0,
    );
    if (declared > 0) return declared;
    // Fallback: conta itens transcritos.
    const sum = step.substeps.reduce(
      (acc, s) =>
        acc +
        s.items.reduce((inner, item) => inner + (item.isPending ? 0 : 1), 0),
      0,
    );
    return sum > 0 ? sum : step.maxScore ?? null;
  }

  async getActiveClassifications(): Promise<ClassificationConfig[]> {
    return this.prisma.classificationConfig.findMany({
      where: { active: true },
      orderBy: { minScore: 'asc' },
    });
  }

  async classify(totalScore: number): Promise<string | null> {
    const configs = await this.getActiveClassifications();
    const match = configs.find(
      (c) => totalScore >= c.minScore && totalScore <= c.maxScore,
    );
    return match?.classification ?? null;
  }

  async upsertClassification(input: {
    name?: string;
    classification: string;
    minScore: number;
    maxScore: number;
    description?: string;
    active?: boolean;
    id?: string;
  }) {
    if (input.id) {
      return this.prisma.classificationConfig.update({
        where: { id: input.id },
        data: input,
      });
    }
    return this.prisma.classificationConfig.create({
      data: {
        name: input.name ?? input.classification,
        classification: input.classification,
        minScore: input.minScore,
        maxScore: input.maxScore,
        description: input.description,
        active: input.active ?? true,
      },
    });
  }
}