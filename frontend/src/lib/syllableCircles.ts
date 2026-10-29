export function countSyllables(prompt: string | null | undefined): number {
  return prompt?.match(/\/[^/]+\//g)?.length ?? 0;
}

export function circleCountForPrompt(prompt: string | null | undefined): number {
  const syllableCount = countSyllables(prompt);
  return syllableCount > 0 ? syllableCount + 1 : 0;
}

export function isCorrectSyllableSelection(
  selectedCircleCount: number,
  prompt: string | null | undefined,
): boolean {
  const syllableCount = countSyllables(prompt);
  return syllableCount > 0 && selectedCircleCount === syllableCount;
}
