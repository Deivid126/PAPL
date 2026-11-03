/**
 * Círculos da segmentação silábica.
 *
 * A prancha mostra sempre a mesma quantidade de círculos, independente de
 * quantas sílabas a palavra tem: a criança bate em um círculo por sílaba que
 * identifica, e a quantidade de círculos não pode entregar a resposta.
 *
 * Quem decide o acerto é o aplicador, ao prosseguir — não a contagem.
 */
export const SYLLABLE_CIRCLE_COUNT = 3;

export function countSyllables(prompt: string | null | undefined): number {
  return prompt?.match(/\/[^/]+\//g)?.length ?? 0;
}

export function circleCountForPrompt(_prompt?: string | null | undefined): number {
  return SYLLABLE_CIRCLE_COUNT;
}
