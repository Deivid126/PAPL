/* eslint-disable no-console */
/**
 * Atualiza SÓ os exemplos de treino da segmentação silábica (etapa 2, subetapa 2).
 *
 * Existe porque `prisma/seed.ts` apaga e recria o protocolo inteiro, e
 * ApplicationStep referencia ProtocolStep com onDelete: Cascade — rodar o seed
 * num banco com aplicações já registradas destrói esses dados.
 *
 * Este script não apaga nada: faz um único `update` em
 * ProtocolSubstep.trainingExamples. Itens da prova, aplicações e respostas
 * ficam intactos.
 *
 *   npx ts-node prisma/update-segmentation-training.ts
 */
import { PrismaClient } from '@prisma/client';
import { segmentationTrainingExamples } from './data/segmentation-training';

const STEP_NUMBER = 2;
const SUBSTEP_ORDER = 2;

const prisma = new PrismaClient();

async function main() {
  const substep = await prisma.protocolSubstep.findUnique({
    where: { stepNumber_order: { stepNumber: STEP_NUMBER, order: SUBSTEP_ORDER } },
    select: { id: true, title: true, trainingExamples: true },
  });

  if (!substep) {
    throw new Error(
      `Subetapa ${STEP_NUMBER}.${SUBSTEP_ORDER} não encontrada. O protocolo já foi populado neste banco?`,
    );
  }

  if (!/segmenta/i.test(substep.title)) {
    throw new Error(
      `Subetapa ${STEP_NUMBER}.${SUBSTEP_ORDER} tem o título "${substep.title}", que não é a segmentação silábica. Abortando para não escrever no lugar errado.`,
    );
  }

  const before: string[] = substep.trainingExamples ? JSON.parse(substep.trainingExamples) : [];
  const after = segmentationTrainingExamples();

  console.log(`Subetapa: ${substep.title}`);
  console.log(`Exemplos antes (${before.length}):`);
  before.forEach((e) => console.log(`  - ${e}`));
  console.log(`Exemplos depois (${after.length}):`);
  after.forEach((e) => console.log(`  - ${e}`));

  await prisma.protocolSubstep.update({
    where: { id: substep.id },
    data: { trainingExamples: JSON.stringify(after) },
  });

  console.log('\nTrainingExamples atualizado. Nenhum item, aplicação ou resposta foi tocado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
