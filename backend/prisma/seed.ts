/* eslint-disable no-console */
/**
 * Seed do banco — PAPL
 *
 * Popula:
 *  - A estrutura do protocolo (etapas, subetapas, instruções, exemplos, itens).
 *  - Um usuário de desenvolvimento (e-mail verificado).
 *
 * IMPORTANTE sobre os itens do PDF:
 *  O PDF original do PAPL não acompanha este repositório. Itens cuja fonte
 *  é exclusivamente o material visual/impresso do protocolo (palavras da
 *  síntese/segmentação silábica, pseudopalavras, prancha de figuras e
 *  sentenças) são criados com `isPending = true` e NENHUM valor fictício.
 *  A interface e o README explicam como fornecer o material (PDF/imagens).
 *
 *  Os itens de vogais/consoantes (letras) são inequívocos no protocolo
 *  (5 vogais, 18 consoantes) e são transcritos com segurança.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const VOWELS = ['E', 'A', 'U', 'I', 'O'];
const CONSONANTS = [
  'S', 'R', 'N', 'T', 'C', 'L',
  'P', 'V', 'G', 'H', 'Q', 'B',
  'F', 'Z', 'J', 'D', 'M', 'X',
];

function pendingItems(count: number, note: string) {
  return Array.from({ length: count }, (_, i) => ({
    itemNumber: i + 1,
    prompt: null,
    expectedAnswer: null,
    imageKey: null,
    isPending: true,
    responseType: 'TEXT',
    // NOTA: nada de conteúdo fictício aqui.
    // A observação é registrada para auditoria.
  }));
}

const SYNTHESIS_TRAINING = [
  { label: 'Exemplo 1', syllables: '/"Me/-/za/', answer: 'mesa', image: 'mesa.png' },
  { label: 'Exemplo 2', syllables: '/Com/-/pu/-/ta/-/"dor/', answer: 'computador', image: 'computador.png' },
];

const SYNTHESIS_ITEMS = [
  ['/ka/ /\'fé/', 'café', 'café.png'],
  ['/\'de/ /do/', 'dedo', 'dedo.png'],
  ['/\'pa/ /to/', 'pato', 'pato.png'],
  ['/\'Ra/ /to/', 'rato', 'rato.png'],
  ['/\'ba/ /la/', 'bala', 'bala.png'],
  ['/ta/ /\'tu/', 'tatu', 'tatu.png'],
  ['/\'fa/ /da/', 'fada', 'fada.png'],
  ['/ʃu/ /\'pe/ /ta/', 'chupeta', 'chupeta.png'],
  ['/ga/ /\'ve/ /ta/', 'gaveta', 'gaveta.png'],
  ['/bo/ /\'la/ /ʃa/', 'bolacha', 'bolacha.png'],
  ['/ka/ /\'be/ /lo/', 'cabelo', 'cabelo.png'],
  ['/to/ /\'ma/ /da/', 'tomada', 'tomada.png'],
  ['/vi/ /\'ɔ/ /la/', 'viola', 'viola.png'],
  ['/fa/ /\'zen/ /da/', 'fazenda', 'fazenda.png'],
  ['/ma/ /ma/ /\'dej/ /ra/', 'mamadeira', 'mamadeira.png'],
  ['/sa/ /bo/ /\'ne/ /te/', 'sabonete', 'sabonete.png'],
  ['/a/ /ba/ /\'ka/ /te/', 'abacate', 'abacate.png'],
  ['/be/ /te/ /\'Ra/ /ba/', 'beterraba', 'beterraba.png'],
  ['/a/ /ma/ /\'Re/ /lo/', 'amarelo', 'amarelo.png'],
  ['/ma/ /ka/ /\'ka/ /da/', 'macacada', 'macacada.png'],
  ['/pe/ /ri/ /\'go/ /zo/', 'perigoso', 'perigoso.png'],
] as const;

// Segmentação silábica — tabela do protocolo (treino + prova).
// Formato: [palavra, prompt de sílabas, arquivo de imagem]
const SEGMENTATION_TRAINING: Array<[string, string, string | null]> = [
  ['bala', `/"ba/ -/la/`, 'bala.png'],
  ['martelo', `/mar/-/'te/-/lo/`, 'martelo.png'],
];

const SEGMENTATION_ITEMS: Array<[string, string, string]> = [
  ['vaca', `/"va/ -/ka/`, 'vaca.png'],
  ['coração', `/ko/ -/ra/ -/'são/`, 'coracao.png'],
  ['lama', `/"la/ -/ma/`, 'lama.png'],
  ['cama', `/'cá/ -/ma/`, 'cama.png'],
  ['panela', `/pa/ -/'ne/ -/la/`, 'panela.png'],
  ['dinamite', `/dʒi/ -/na/ -/'mi/ -/te/`, 'dinamite.png'],
  ['neve', `/"ne/ -/ve/`, 'bola_de_neve.png'],
  ['mola', `/'mo/ -/la/`, 'mola.png'],
  ['garrafa', `/ga/ -/"Ra/ -/fa/`, 'garrafa.png'],
  ['bicicleta', `/bi/ -/si/ -/'cle/ -/ta/`, 'bicicleta.png'],
  ['sala', `/'sa/ -/la/`, 'sala.png'],
  ['bexiga', `/be/ -/'ʃi/ -/ga/`, 'bexiga.png'],
  ['chocolate', `/ʃo/ -/ko/ -/'la/ -/te/`, 'chocolate.jpg'],
  ['farofa', `/fa/ -/'rc/ -/fa/`, 'farofa.jpg'],
  ['pano', `/'pá/ -/no/`, 'pano.png'],
  ['sabonete', `/sa/ -/bo/ -/'ne/ -/ʃte/`, 'sabonete.png'],
  ['pomada', `/po/ -/'ma/ -/da/`, 'pomada.png'],
  ['televisão', `/te/ -/le/ -/vi/ -/'zão/`, 'televisao.png'],
  ['menina', `/me/ -/'ni/ -/na/`, 'menina.png'],
  ['professora', `/pro/ -/fe/ -/'so/ -/ra/`, 'professora.png'],
  ['computador', `/kõ/ -/pu/ -/ta/ -/'dor/`, 'computador.png'],
] as const;

// Identificação de som ou sílaba inicial — tabela do protocolo (treino + prova).
// Formato: [palavra, respostas esperadas (prompt), arquivo de imagem]
const PHONEME_TRAINING: Array<[string, string, string]> = [
  ['sapo', `/s/ ou /sa/`, 'sapo.png'],
  ['vaca', `/v/ ou /va/`, 'vaca.png'],
];

const PHONEME_ITEMS: Array<[string, string, string]> = [
  ['boca', `/b/ ou /bo/`, 'boca.png'],
  ['peixe', `/p/ ou /pe/ ou /pei/`, 'peixe.png'],
  ['fita', `/f/ ou /fi/`, 'fita.png'],
  ['zebra', `/z/ ou /ze/`, 'zebra.png'],
  ['caju', `/k/ ou /ka/`, 'caju.png'],
  ['vila', `/v/ ou /vi/`, 'vila.png'],
  ['dedo', `/d/ ou /de/`, 'dedo.png'],
  ['galo', `/g/ ou /ga/`, 'galo.png'],
  ['janela', `/ʒ/ ou /ʒa/`, 'janela.png'],
  ['lápis', `/l/ ou /la/`, 'lapis.png'],
  ['maçã', `/m/ ou /ma/`, 'maca.png'],
  ['navio', `/n/ ou /na/`, 'navio.png'],
  ['amora', `/a/`, 'amora.png'],
  ['ovo', `/o/`, 'ovo.png'],
  ['elefante', `/e/`, 'elefante.png'],
  ['igreja', `/i/`, 'igreja.png'],
  ['urubu', `/u/`, 'urubu.png'],
  ['robô', `/R/ ou /Ro/`, 'robo.png'],
  ['cipó', `/s/ ou /si/`, 'cipo.png'],
  ['tomate', `/t/ ou /to/`, 'tomate.png'],
  ['xícara', `/ʃ/ ou /ʃi/`, 'xicara.png'],
] as const;

// Produção de palavras a partir de fonemas e sílabas iniciais (treino + prova).
// Formato prova: [prompt (fonema/sílaba), palavra aceita, imagem correta, distrator 1, distrator 2]
const PRODUCTION_TRAINING: Array<[string, string, string]> = [
  ['sapo, cinto, sol...', '/s/', 'sapo.png'],
  ['vaca, vaga, vassoura...', '/va/', 'vaca.png'],
];

const PRODUCTION_ITEMS: Array<[string, string, string, string, string]> = [
  ['/a/', 'abelha', 'abelha.png', 'elefante.png', 'igreja.png'],
  ['/da/', 'dado', 'dado.png', 'tatu.png', 'vaca.png'],
  ['/ga/', 'gato', 'gato.png', 'pato.png', 'jacare.png'],
  ['/la/', 'lápis', 'lapis.png', 'zebra.png', 'bola.png'],
  ['/o/', 'ovo', 'ovo.png', 'urso.png', 'sol.png'],
  ['/Ra/', 'rato', 'rato.png', 'gato.png', 'bola.png'],
  ['/bo/', 'bola', 'bola.png', 'vaca.png', 'chave.png'],
  ['/e/', 'elefante', 'elefante.png', 'abelha.png', 'faca.png'],
  ['/i/', 'igreja', 'igreja.png', 'lapis.png', 'maca.png'],
  ['/ma/', 'maçã', 'maca.png', 'navio.png', 'dado.png'],
  ['/pa/', 'pato', 'pato.png', 'gato.png', 'cinto.png'],
  ['/s/', 'sapo', 'sapo.png', 'vaca.png', 'tatu.png'],
  ['/ka/', 'cama', 'cama.png', 'maca.png', 'jacare.png'],
  ['/f/', 'faca', 'faca.png', 'chave.png', 'sol.png'],
  ['/ʒ/', 'jacaré', 'jacare.png', 'gato.png', 'pato.png'],
  ['/na/', 'navio', 'navio.png', 'ovo.png', 'igreja.png'],
  ['/ta/', 'tatu', 'tatu.png', 'dado.png', 'ovo.png'],
  ['/u/', 'urso', 'urso.png', 'vaca.png', 'jacare.png'],
  ['/v/', 'vaca', 'vaca.png', 'pato.png', 'elefante.png'],
  ['/ʃ/', 'chave', 'chave.png', 'faca.png', 'bola.png'],
  ['/z/', 'zebra', 'zebra.png', 'lapis.png', 'navio.png'],
] as const;

// Compreensão auditiva de sentenças a partir de figuras (treino + prova).
// Formato treino: [frase, palavra esperada, imagem da questão, corretas adicionais (várias aceitas)]
// Formato prova: [frase, palavra esperada, imagem da questão, imagem correta, distrator 1, distrator 2]
const COMPREHENSION_TRAINING: Array<[string, string, string, string]> = [
  ['A menina anda de ___ (bicicleta)', 'bicicleta', 'exemplo-1.png', 'bicicleta.png'],
  ['O cachorro pegou o ___ (osso)', 'osso', 'exemplo-2.png', 'osso.png'],
];

const COMPREHENSION_ITEMS: Array<[string, string, string, string, string, string]> = [
  ['O menino está pescando no ___', 'rio', 'item-1.png', 'rio.png', 'praia.png', 'piscina.png'],
  ['As ___ brincam de roda', 'crianças', 'item-2.png', 'criancas.png', 'animais.png', 'mulher.png'],
  ['O menino chuta a bola no ___', 'gol', 'item-3.png', 'gol.png', 'gramado.png', 'pedra.png'],
  ['A girafa passeia com os outros animais na ___', 'floresta', 'item-4.png', 'floresta.png', 'escola.png', 'praia.png'],
  ['Os ___ estão indo para o rio', 'patos', 'item-5.png', 'pato.png', 'peixe.png', 'gato.png'],
  ['Os pássaros estão fugindo da ___', 'gaiola', 'item-6.png', 'gaiola.png', 'casa.png', 'hospital.png'],
  ['As crianças estão brincando com as ___', 'bexigas', 'item-7.png', 'bexiga.png', 'bola.png', 'desenho.png'],
  ['João e Pedro brincam com os ___', 'barcos', 'item-8.png', 'barco.png', 'carro.png', 'aviao.png'],
  ['O menino está brincando na ___', 'árvore', 'item-9.png', 'arvore.png', 'cadeira.png', 'escada.png'],
  ['Pedro e sua mãe foram ao ___ comprar frutas', 'supermercado', 'item-10.png', 'supermercado.png', 'padaria.png', 'farmacia.png'],
  ['João e Maria estão dançando com a ___', 'música', 'item-11.png', 'musica.png', 'historia.png', 'desenho.png'],
  ['O menino joga a ___ no cesto', 'bola', 'item-12.png', 'bola.png', 'bexiga.png', 'comida.png'],
  ['João e seu pai fazem ___ em um dia de sol', 'exercícios', 'item-13.png', 'fazer_exercicio.png', 'jogo_de_encaixe.png', 'brinquedo.png'],
  ['Artur e seu avô estão indo à ___', 'padaria', 'item-14.png', 'padaria.png', 'hospital.png', 'escola.png'],
  ['Depois de pescar os ___, Pedro e João foram para casa', 'peixes', 'item-15.png', 'peixe.png', 'pato.png', 'gato.png'],
  ['Maria está pulando ___', 'corda', 'item-16.png', 'corda.png', 'pedra.png', 'osso.png'],
  ['O cachorro está indo para ___', 'casa', 'item-17.png', 'casa.png', 'escola.png', 'cavalo.png'],
  ['Os meninos estão correndo na ___', 'chuva', 'item-18.png', 'chuva.png', 'cavalo.png', 'ilha.png'],
  ['A menina está molhando a ___ com o regador', 'flor', 'item-19.png', 'flor.png', 'cavalo.png', 'sapatos.png'],
  ['Os ___ estão segurando as bexigas', 'palhaços', 'item-20.png', 'palhaco.png', 'medico.png', 'policia.png'],
] as const;

async function seedProtocol() {
  // O seed pode rodar várias vezes: recria apenas as tabelas do protocolo.
  await prisma.protocolItem.deleteMany();
  await prisma.protocolSubstep.deleteMany();
  await prisma.protocolStep.deleteMany();

  // ETAPA 1 — Conhecimento do alfabeto
  await prisma.protocolStep.create({
    data: {
      stepNumber: 1,
      title: 'Conhecimento do alfabeto',
      skill: 'conhecimento_alfabeto',
      instructions:
        'Aplicar os exemplos de treinamento e, em seguida, apresentar cada letra ' +
        'individualmente. Registrar a resposta da criança e marcar acerto ou erro. ' +
        'Pontuação máxima: 23 pontos.',
      position: 1,
      substeps: {
        create: [
          {
            order: 1,
            title: '1.1 Conhecimento das vogais',
            instructions:
              'Apresentar as cinco vogais individualmente. A criança deve reconhecer e ' +
              'nomear a letra exibida. Pontuação máxima: 5 pontos.',
            maxScore: 5,
            trainingExamples: JSON.stringify(['Exemplo 1: I', 'Exemplo 2: O']),
            items: {
              create: VOWELS.map((letter, i) => ({
                itemNumber: i + 1,
                prompt: `Apresente a vogal "${letter}".`,
                expectedAnswer: letter,
                imageKey: `protocolo/etapa1/vogais/${letter.toLowerCase()}.png`,
                isPending: false,
                responseType: 'LETTER',
              })),
            },
          },
          {
            order: 2,
            title: '1.2 Conhecimento das consoantes',
            instructions:
              'Apresentar as dezoito consoantes individualmente. A criança deve reconhecer e ' +
              'nomear a letra exibida. Pontuação máxima: 18 pontos.',
            maxScore: 18,
            trainingExamples: JSON.stringify(['Exemplo 1: V', 'Exemplo 2: P']),
            items: {
              create: CONSONANTS.map((letter, i) => ({
                itemNumber: i + 1,
                prompt: `Apresente a consoante "${letter}".`,
                expectedAnswer: letter,
                imageKey: `protocolo/etapa1/consoantes/${letter.toLowerCase()}.png`,
                isPending: false,
                responseType: 'LETTER',
              })),
            },
          },
        ],
      },
    },
  });

  // ETAPA 2 — Habilidades metafonológicas (4 subetapas, 21 itens cada)
  const meta = [
    {
      order: 1,
      title: '2.1 Síntese silábica',
      instructions:
        'O avaliador apresenta as sílabas separadas e a criança deve dizer a palavra formada. ' +
        'Registrar palavra apresentada, resposta esperada, resposta da criança, acerto/erro e ' +
        'observações. Pontuação máxima: 21 pontos.',
    },
    {
      order: 2,
      title: '2.2 Segmentação silábica',
      instructions:
        'O avaliador apresenta uma palavra e a criança deve separar a palavra em sílabas. ' +
        'Registrar quantidade esperada de sílabas, resposta da criança, acerto/erro e observações. ' +
        'Pontuação máxima: 21 pontos.',
    },
    {
      order: 3,
      title: '2.3 Identificação de som ou sílaba inicial',
      instructions:
        'A tela mostra a figura, sem o nome escrito, e três letras: a inicial correta e dois distratores. ' +
        'A criança toca na letra com que a palavra começa, e o registro de acerto ou erro é automático. ' +
        'Pontuação máxima: 21 pontos.',
    },
    {
      order: 4,
      title: '2.4 Produção de palavras a partir de fonemas e sílabas iniciais',
      instructions:
        'O avaliador fala um som ou uma sílaba e a criança deve dizer uma palavra que comece com esse som ou sílaba. ' +
        'A tela mostra três figuras: a criança aponta (ou o avaliador assinala) e o avaliador marca acerto ou erro. ' +
        'Respostas aceitas: qualquer palavra que comece com o fonema/sílaba apresentado. Pontuação máxima: 21 pontos.',
    },
  ];

  await prisma.protocolStep.create({
    data: {
      stepNumber: 2,
      title: 'Habilidades metafonológicas',
      skill: 'habilidades_metafonologicas',
      instructions:
        'Quatro subetapas avaliam consciência fonológica: síntese silábica, segmentação ' +
        'silábica, identificação de som ou sílaba inicial e produção de palavras. ' +
        'Pontuação máxima: 84 pontos.',
      position: 2,
      substeps: {
        create: meta.map((m) => ({
          order: m.order,
          title: m.title,
          instructions: m.instructions,
          maxScore: 21,
          trainingExamples: JSON.stringify(
            m.order === 1
              ? SYNTHESIS_TRAINING.map((item) => `${item.label}|${item.syllables}|${item.answer}|${item.image}`)
              : m.order === 2
              ? SEGMENTATION_TRAINING.map(([word, syllables, image], i) => `Exemplo ${i + 1}|${syllables}|${word}|${image ?? ''}`)
              : m.order === 3
              ? PHONEME_TRAINING.map(([word, prompt, image], i) => `Exemplo ${i + 1}|${prompt}|${word}|${image}`)
              : m.order === 4
              ? PRODUCTION_TRAINING.map(([answers, prompt, image], i) => `Exemplo ${i + 1}|${prompt}|${answers}|${image}`)
              : ['Apresente os exemplos de treinamento descritos no protocolo.'],
          ),
          items: {
            create: m.order === 1
              ? SYNTHESIS_ITEMS.map(([syllables, answer, image], index) => ({
                  itemNumber: index + 1,
                  prompt: syllables,
                  expectedAnswer: answer,
                  imageKey: `sintese_silabica/${image}`,
                  isPending: false,
                  responseType: 'IMAGE_CHOICE',
                }))
              : m.order === 2
              ? SEGMENTATION_ITEMS.map(([word, syllables, image], index) => ({
                  itemNumber: index + 1,
                  prompt: syllables,
                  expectedAnswer: word,
                  imageKey: `segmentacao_silabica/${image}`,
                  isPending: false,
                  responseType: 'SEGMENTATION',
                }))
              : m.order === 3
              ? PHONEME_ITEMS.map(([word, prompt, image], index) => ({
                  itemNumber: index + 1,
                  prompt,
                  expectedAnswer: word,
                  imageKey: `identificacao_fonema/${image}`,
                  isPending: false,
                  responseType: 'PHONEME',
                }))
              : m.order === 4
              ? PRODUCTION_ITEMS.map(([prompt, word, correct, d1, d2], index) => ({
                  itemNumber: index + 1,
                  prompt,
                  expectedAnswer: word,
                  imageKey: `producao/objetos/${correct}`,
                  isPending: false,
                  responseType: 'PRODUCTION',
                }))
              : pendingItems(21, 'm.lista'),
          },
        })),
      },
    },
  });

  // ETAPA 3 — Nomeação automática rápida (pranchas de figuras, cronometrada).
  // O antigo módulo de pseudopalavras foi removido do protocolo.
  await prisma.protocolStep.create({
    data: {
      stepNumber: 3,
      title: 'Nomeação automática rápida',
      skill: 'nomeacao_automatica_rapida',
      instructions:
        'A criança olha as figuras e diz o nome de cada uma, em sequência, linha por linha, o mais rápido que conseguir, ' +
        'sem apontar com o dedo (acompanha apenas com os olhos). Usar a prancha de exemplo para nomeação (sem marcar tempo), ' +
        'depois iniciar o cronômetro na prancha da prova e encerrar quando a criança falar o último estímulo. ' +
        'O treino não é contabilizado; anotar o tempo total de execução, em segundos. ' +
        'Itens pulados devem ser registrados nas observações.',
      position: 3,
      timerRequired: true,
      substeps: {
        create: [
          {
            order: 1,
            title: '3.1 Nomeação automática rápida (prancha de figuras)',
            instructions:
              'Mostre a prancha de exemplo (chave, casa, pato, bola, carro) e peça que nomeie cada figura. ' +
              'Depois mostre a prancha da prova, inicie o cronômetro e finalize quando a criança nomear a última figura. ' +
              'Registre itens pulados nas observações.',
            maxScore: null,
            timerRequired: true,
            trainingExamples: JSON.stringify([
              'Exemplo|chave, casa, pato, bola, carro|nomeacao-exemplo|exemplo.png',
            ]),
            items: {
              create: [
                {
                  itemNumber: 1,
                  prompt: 'Prancha de prova (35 figuras, 7 linhas).',
                  expectedAnswer: null,
                  imageKey: 'nomeacao_automatica/prancha-prova.png',
                  isPending: false,
                  responseType: 'TIMED',
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ETAPA 4 — Compreensão auditiva de sentenças a partir de figuras (20 itens)
  // (renumerada: a antiga etapa 3 de pseudopalavras foi removida)
  await prisma.protocolStep.create({
    data: {
      stepNumber: 4,
      title: 'Compreensão auditiva de sentenças',
      skill: 'compreensao_auditiva_sentencas',
      instructions:
        'Apresentar cada sentença com sua figura correspondente. A criança deve completar a ' +
        'frase com a palavra que falta. Permitir respostas alternativas semanticamente ' +
        'compatíveis. Pontuação máxima: 20 pontos.',
      position: 4,
      substeps: {
        create: [
          {
            order: 1,
            title: '4.1 Completar sentenças a partir de figuras',
            instructions:
              'Fale a frase e peça que a criança complete com a palavra que falta, olhando a figura. ' +
              'Na tela aparecem três figuras: a criança aponta (ou fala) e o sistema/com avaliador marca acerto ou erro. ' +
              'Respostas alternativas semanticamente compatíveis devem ser aceitas (avalidor pode marcar acerto manualmente). ' +
              'Pontuação máxima: 20 pontos.',
            maxScore: 20,
            trainingExamples: JSON.stringify(
              COMPREHENSION_TRAINING.map(([sentence, answer, image], i) =>
                `Exemplo ${i + 1}|${sentence}|${answer}|compreensao_sentencas/questoes/${image}`,
              ),
            ),
            items: {
              create: COMPREHENSION_ITEMS.map(([sentence, word, questionImage, correct, d1, d2], index) => ({
                itemNumber: index + 1,
                prompt: sentence,
                expectedAnswer: word,
                imageKey: `compreensao_sentencas/questoes/${questionImage}`,
                isPending: false,
                responseType: 'COMPREHENSION',
              })),
            },
          },
        ],
      },
    },
  });

  console.log('Protocolo (etapas/subetapas/itens) criado/atualizado com sucesso.');
}

async function seedDevUser() {
  const email = process.env.SEED_DEV_EMAIL ?? 'avaliador@papl.dev';
  const password = process.env.SEED_DEV_PASSWORD ?? 'Pap1@2024';
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: 'Avaliador de Desenvolvimento' },
    create: {
      email,
      name: 'Avaliador de Desenvolvimento',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Usuário de desenvolvimento pronto: ${email}`);
  console.log(`Senha: ${password}`);
  return user;
}

async function main() {
  await seedProtocol();

  // O usuário de desenvolvimento tem credenciais conhecidas e documentadas
  // no .env.example, então nunca deve ser criado em produção. Para criá-lo
  // deliberadamente fora de desenvolvimento, use SEED_DEV_USER=true.
  const seedUser =
    process.env.SEED_DEV_USER === 'true' ||
    (process.env.SEED_DEV_USER !== 'false' && process.env.NODE_ENV !== 'production');

  if (seedUser) {
    await seedDevUser();
  } else {
    console.log('Usuário de desenvolvimento ignorado (NODE_ENV=production).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });