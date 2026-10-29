export type SectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINALIZED';
export type SectionFinalizedReason = 'ALL_ITEMS_ANSWERED' | 'ERROR_LIMIT';

export interface SectionResponse {
  isCorrect: boolean | null;
  childAnswer?: string | null;
  responseTimeMs?: number | null;
}

export interface DerivedSectionState {
  status: SectionStatus;
  finalizedReason: SectionFinalizedReason | null;
  consecutiveErrors: number;
}

function isAnswered(item: SectionResponse): boolean {
  return (
    item.isCorrect !== null ||
    (item.childAnswer != null && item.childAnswer !== '') ||
    item.responseTimeMs != null
  );
}

/** Derives a session section's state in protocol order; it has no global state. */
export function deriveSectionState(items: SectionResponse[]): DerivedSectionState {
  let consecutiveErrors = 0;
  let anyAnswered = false;

  for (const item of items) {
    anyAnswered ||= isAnswered(item);
    if (item.isCorrect === false) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 5) {
        return {
          status: 'FINALIZED',
          finalizedReason: 'ERROR_LIMIT',
          consecutiveErrors: 5,
        };
      }
    } else {
      consecutiveErrors = 0;
    }
  }

  if (items.length > 0 && items.every(isAnswered)) {
    return {
      status: 'FINALIZED',
      finalizedReason: 'ALL_ITEMS_ANSWERED',
      consecutiveErrors: 0,
    };
  }

  return {
    status: anyAnswered ? 'IN_PROGRESS' : 'NOT_STARTED',
    finalizedReason: null,
    consecutiveErrors,
  };
}
