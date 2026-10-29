import { describe, expect, it } from 'vitest';
import { countSyllables, circleCountForPrompt, isCorrectSyllableSelection } from './syllableCircles';

describe('syllable circle counts', () => {
  it('creates three circles for the two syllables in vaca', () => {
    const prompt = `/"va/ -/ka/`;
    expect(countSyllables(prompt)).toBe(2);
    expect(circleCountForPrompt(prompt)).toBe(3);
  });

  it('creates four circles for the three syllables in martelo', () => {
    const prompt = `/mar/-/'te/-/lo/`;
    expect(countSyllables(prompt)).toBe(3);
    expect(circleCountForPrompt(prompt)).toBe(4);
  });

  it('marks the answer correct when the child selects one circle per syllable', () => {
    expect(isCorrectSyllableSelection(2, `/"va/ -/ka/`)).toBe(true);
    expect(isCorrectSyllableSelection(1, `/"va/ -/ka/`)).toBe(false);
    expect(isCorrectSyllableSelection(4, `/mar/-/'te/-/lo/`)).toBe(false);
  });
});
