import type { Application, ApplicationItem, ProtocolStep } from './types';

export interface ResumeCursor {
  stepNumber: number;
  substepOrder: number;
  /** Posição entre os itens oficiais da subetapa. Exemplos de treino não entram nessa conta. */
  localIndex: number;
  /** Posição entre os itens oficiais da etapa inteira. */
  unitIndex: number;
}

function isSavedAnswer(item: ApplicationItem): boolean {
  return (
    item.isCorrect === true ||
    item.isCorrect === false ||
    (item.childAnswer != null && item.childAnswer !== '') ||
    item.responseTimeMs != null
  );
}

/**
 * Volta para o item oficial salvo por último.
 *
 * O número gravado segue a ordem da prova (1, 2, 3...), sem os exemplos.
 * Se há 4 testes e o terceiro foi o último salvo, a volta cai nele — não
 * no exemplo e não no teste seguinte.
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
  for (const sub of protocolStep.substeps) {
    for (let index = 0; index < sub.items.length; index += 1) {
      global += 1;
      if (global !== best.itemNumber) continue;
      return {
        stepNumber: best.stepNumber,
        substepOrder: sub.order,
        localIndex: index,
        unitIndex: global - 1,
      };
    }
  }

  return { stepNumber: best.stepNumber, substepOrder: protocolStep.substeps[0]?.order ?? 1, localIndex: 0, unitIndex: 0 };
}
