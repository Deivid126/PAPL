import { describe, expect, it } from 'vitest';
import { resumeCursor } from './resume';
import type { Application, ProtocolStep } from './types';

const protocol: ProtocolStep[] = [
  {
    id: 'p1',
    stepNumber: 1,
    title: 'Alfabeto',
    skill: 'conhecimento_alfabeto',
    instructions: '',
    maxScore: 4,
    timerRequired: false,
    position: 1,
    substeps: [
      {
        id: 's1',
        stepNumber: 1,
        order: 1,
        title: '1.1 Vogais',
        instructions: '',
        trainingExamples: ['Exemplo 1: I', 'Exemplo 2: O'],
        maxScore: 4,
        timerRequired: false,
        items: [1, 2, 3, 4].map((n) => ({
          id: `i${n}`,
          substepId: 's1',
          itemNumber: n,
          prompt: null,
          expectedAnswer: String(n),
          imageKey: null,
          isPending: false,
          responseType: 'LETTER',
        })),
      },
    ],
  },
];

function appWith(itemNumber: number, currentStep = 2): Application {
  return {
    id: 'app1',
    childId: 'c1',
    evaluatorId: 'u1',
    status: 'IN_PROGRESS',
    startedAt: '2026-10-01T00:00:00.000Z',
    completedAt: null,
    currentStep,
    totalScore: null,
    classification: null,
    notes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    steps: [
      {
        id: 'as1',
        applicationId: 'app1',
        stepNumber: 1,
        skill: 'conhecimento_alfabeto',
        maxScore: 4,
        status: 'IN_PROGRESS',
        score: 1,
        startedAt: null,
        completedAt: null,
        notes: null,
        items: [
          {
            id: 'ai3',
            applicationStepId: 'as1',
            itemNumber,
            prompt: null,
            expectedAnswer: 'C',
            childAnswer: 'C',
            isCorrect: true,
            score: 1,
            responseTimeMs: null,
            notes: null,
            updatedAt: '2026-10-15T12:00:00.000Z',
          },
        ],
      },
    ],
  };
}

describe('resumeCursor', () => {
  it('volta no terceiro teste salvo, sem contar os exemplos e sem avançar para o seguinte', () => {
    const cursor = resumeCursor(appWith(3), protocol);
    expect(cursor).toEqual({ stepNumber: 1, substepOrder: 1, localIndex: 2, unitIndex: 2 });
  });

  it('ignora a etapa seguinte quando ela ainda não tem resposta salva', () => {
    expect(resumeCursor(appWith(3, 2), protocol)?.stepNumber).toBe(1);
  });

  it('não inventa posição quando nada foi salvo', () => {
    const empty = appWith(3);
    empty.steps![0].items = [];
    expect(resumeCursor(empty, protocol)).toBeNull();
  });
});
