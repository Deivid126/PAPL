import { describe, expect, it } from 'vitest';
import { countSyllables } from './syllableCircles';

describe('countSyllables', () => {
  it('counts the syllables in the prompt', () => {
    expect(countSyllables(`/"va/ -/ka/`)).toBe(2);
    expect(countSyllables(`/mar/-/'te/-/lo/`)).toBe(3);
    expect(countSyllables(null)).toBe(0);
  });
});
