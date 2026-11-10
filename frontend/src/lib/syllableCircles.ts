/**
 * Conta as sílabas de um prompt no formato /va/ -/ka/.
 *
 * A segmentação silábica já foi respondida por toque em círculos, gravando a
 * quantidade batida. O resultado ainda usa esta conta para mostrar o esperado
 * nas aplicações daquela época.
 */
export function countSyllables(prompt: string | null | undefined): number {
  return prompt?.match(/\/[^/]+\//g)?.length ?? 0;
}
