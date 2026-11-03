/**
 * Segmentação silábica — exemplos de treino do protocolo.
 *
 * Fica fora do seed.ts porque o seed roda `main()` no import: scripts que só
 * precisam da tabela (ex.: atualizar o trainingExamples sem recriar o
 * protocolo) importam daqui.
 *
 * Formato: [palavra, prompt de sílabas, arquivo de imagem]
 */
export const SEGMENTATION_TRAINING: Array<[string, string, string | null]> = [
  ['bala', `/"ba/ -/la/`, 'bala.png'],
  ['martelo', `/mar/-/'te/-/lo/`, 'martelo.png'],
  ['bola', `/'bɔ/ -/la/`, 'bola.png'],
  ['gato', `/'ga/ -/to/`, 'gato.png'],
  ['pato', `/'pa/ -/to/`, 'pato.png'],
  ['banana', `/ba/ -/'na/ -/na/`, 'banana.png'],
  ['cavalo', `/ka/ -/'va/ -/lo/`, 'cavalo.png'],
  ['sapato', `/sa/ -/'pa/ -/to/`, 'sapato.png'],
];

/** Serializa a tabela no formato guardado em ProtocolSubstep.trainingExamples. */
export function segmentationTrainingExamples(): string[] {
  return SEGMENTATION_TRAINING.map(
    ([word, syllables, image], i) => `Exemplo ${i + 1}|${syllables}|${word}|${image ?? ''}`,
  );
}
