import type { Application, ApplicationItem, ProtocolStep } from './types';

export interface ResumeCursor {
  stepNumber: number;
  substepOrder: number;
  /** Posição entre os itens oficiais da subetapa. Exemplos de treino não entram nessa conta. */
  localIndex: number;
  /** Posição entre os itens oficiais da etapa inteira. */
  unitIndex: number;
  /** Quando a última seção foi finalizada, a próxima pode ainda estar no treino. */
  phase?: 'TRAINING' | 'TEST';
}

function isSavedAnswer(item: ApplicationItem): boolean {
  return (
    item.isCorrect === true ||
    item.isCorrect === false ||
    (item.childAnswer != null && item.childAnswer !== '') ||
    item.responseTimeMs != null
  );
}

function isSectionFinalized(app: Application, stepNumber: number, substepOrder: number): boolean {
  return app.steps
    ?.find((step) => step.stepNumber === stepNumber)
    ?.sections?.find((section) => section.substepOrder === substepOrder)
    ?.status === 'FINALIZED';
}

/**
 * Retoma no último item salvo enquanto sua seção continua aberta. Se a seção
 * foi finalizada, posiciona na primeira seção ainda ativa da sessão, sem
 * reabrir itens encerrados nem contabilizar os exemplos de treino.
 */
export function resumeCursor(app: Application, protocol: ProtocolStep[]): ResumeCursor | null {
  let best: { at: string; stepNumber: number; itemNumber: number } | null = null;
  for (const step of app.steps ?? []) {
    for (const item of step.items ?? []) {
      if (!isSavedAnswer(item)) continue;
      const at = item.updatedAt ?? '';
      const newer =
        !best ||
        at > best.at ||
        (at === best.at &&
          (step.stepNumber > best.stepNumber ||
            (step.stepNumber === best.stepNumber && item.itemNumber > best.itemNumber)));
      if (newer) best = { at, stepNumber: step.stepNumber, itemNumber: item.itemNumber };
    }
  }
  if (!best) return null;

  const protocolStep = protocol.find((step) => step.stepNumber === best.stepNumber);
  if (!protocolStep) {
    return { stepNumber: best.stepNumber, substepOrder: 1, localIndex: 0, unitIndex: 0 };
  }

  let global = 0;
  let savedSubstep: (typeof protocolStep.substeps)[number] | undefined;
  let savedLocalIndex = 0;
  for (const sub of protocolStep.substeps) {
    for (let index = 0; index < sub.items.length; index += 1) {
      global += 1;
      if (global === best.itemNumber) {
        savedSubstep = sub;
        savedLocalIndex = index;
        break;
      }
    }
    if (savedSubstep) break;
  }

  if (!savedSubstep) {
    return {
      stepNumber: best.stepNumber,
      substepOrder: protocolStep.substeps[0]?.order ?? 1,
      localIndex: 0,
      unitIndex: 0,
    };
  }
  if (!isSectionFinalized(app, best.stepNumber, savedSubstep.order)) {
    return {
      stepNumber: best.stepNumber,
      substepOrder: savedSubstep.order,
      localIndex: savedLocalIndex,
      unitIndex: best.itemNumber - 1,
    };
  }

  const orderedSections = protocol
    .flatMap((step) => step.substeps.map((substep) => ({ step, substep })))
    .sort((a, b) => a.step.stepNumber - b.step.stepNumber || a.substep.order - b.substep.order);
  for (const candidate of orderedSections) {
    if (isSectionFinalized(app, candidate.step.stepNumber, candidate.substep.order)) continue;

    let candidateStart = 0;
    for (const previous of candidate.step.substeps) {
      if (previous.order === candidate.substep.order) break;
      candidateStart += previous.items.length;
    }
    const savedItems = app.steps?.find((step) => step.stepNumber === candidate.step.stepNumber)?.items ?? [];
    const savedByNumber = new Map(savedItems.map((item) => [item.itemNumber, item]));
    const answers = candidate.substep.items.map((_, index) => savedByNumber.get(candidateStart + index + 1));
    const hasAnswers = answers.some((item) => item != null && isSavedAnswer(item));
    const firstUnanswered = answers.findIndex((item) => !item || !isSavedAnswer(item));
    const phase = hasAnswers ? 'TEST' : 'TRAINING';
    const localIndex = phase === 'TEST' && firstUnanswered >= 0 ? firstUnanswered : 0;

    return {
      stepNumber: candidate.step.stepNumber,
      substepOrder: candidate.substep.order,
      localIndex,
      unitIndex: candidateStart + localIndex,
      phase,
    };
  }

  return { stepNumber: 5, substepOrder: 1, localIndex: 0, unitIndex: 0 };
}
