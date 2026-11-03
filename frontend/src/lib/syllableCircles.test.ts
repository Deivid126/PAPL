import { describe, expect, it } from 'vitest';
import { countSyllables, circleCountForPrompt, SYLLABLE_CIRCLE_COUNT } from './syllableCircles';

describe('syllable circle counts', () => {
  it('always shows three circles, whatever the syllable count', () => {
    // A quantidade de círculos não pode entregar a resposta à criança.
    expect(circleCountForPrompt(`/"va/ -/ka/`)).toBe(3);
    expect(circleCountForPrompt(`/mar/-/'te/-/lo/`)).toBe(3);
    expect(circleCountForPrompt(`/kõ/ -/pu/ -/ta/ -/'dor/`)).toBe(3);
    expect(circleCountForPrompt(null)).toBe(SYLLABLE_CIRCLE_COUNT);
  });

  it('still counts the syllables in the prompt, for the evaluator reference', () => {
    expect(countSyllables(`/"va/ -/ka/`)).toBe(2);
    expect(countSyllables(`/mar/-/'te/-/lo/`)).toBe(3);
    expect(countSyllables(null)).toBe(0);
  });
});
