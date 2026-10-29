import { describe, expect, it } from 'vitest';
import { deriveSectionState } from './sectionProgress';

const correct = { isCorrect: true };
const wrong = { isCorrect: false };
const unanswered = { isCorrect: null };

describe('deriveSectionState', () => {
  it('mantém a seção em andamento enquanto ainda há itens sem resposta', () => {
    expect(deriveSectionState([correct, unanswered])).toEqual({
      status: 'IN_PROGRESS',
      finalizedReason: null,
      consecutiveErrors: 0,
    });
  });

  it('finaliza a seção quando todos os itens foram respondidos', () => {
    expect(deriveSectionState([correct, wrong])).toEqual({
      status: 'FINALIZED',
      finalizedReason: 'ALL_ITEMS_ANSWERED',
      consecutiveErrors: 0,
    });
  });

  it('finaliza apenas após cinco erros consecutivos, reiniciando a sequência em um acerto', () => {
    expect(deriveSectionState([wrong, wrong, correct, wrong, wrong, wrong, wrong, wrong, unanswered])).toEqual({
      status: 'FINALIZED',
      finalizedReason: 'ERROR_LIMIT',
      consecutiveErrors: 5,
    });
  });

  it('não finaliza a seção nem acumula erros através de um item ainda sem resposta', () => {
    expect(deriveSectionState([wrong, wrong, unanswered, wrong, wrong, wrong])).toEqual({
      status: 'IN_PROGRESS',
      finalizedReason: null,
      consecutiveErrors: 3,
    });
  });
});
