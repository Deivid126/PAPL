import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  auth,
  createChild,
  createApplication,
  createTestingApp,
  prismaFrom,
  registerAndLogin,
} from '../../test/utils';

async function saveItem(
  app: INestApplication,
  token: string,
  appId: string,
  stepNumber: number,
  itemNumber: number,
  opts: { correct?: boolean; responseTimeMs?: number } = {},
) {
  return request(app.getHttpServer())
    .post(`/applications/${appId}/steps/${stepNumber}/items`)
    .set(auth(token))
    .send({
      itemNumber,
      childAnswer: opts.correct === undefined ? 'resposta' : opts.correct ? 'ok' : 'errado',
      isCorrect: opts.correct,
      ...(opts.responseTimeMs ? { responseTimeMs: opts.responseTimeMs } : {}),
    });
}

async function markStepCompleted(
  app: INestApplication,
  token: string,
  appId: string,
  stepNumber: number,
) {
  await request(app.getHttpServer())
    .patch(`/applications/${appId}/steps/${stepNumber}`)
    .set(auth(token))
    .send({ status: 'COMPLETED' })
    .expect(200);
}

async function fullAnswer(app: INestApplication, token: string, appId: string) {
  // Etapa 1: 23 itens (5 vogais + 18 consoantes), todos corretos
  for (let i = 1; i <= 23; i++) {
    await saveItem(app, token, appId, 1, i, { correct: true });
  }
  await markStepCompleted(app, token, appId, 1);

  // Etapa 2: 84 itens — respondemos apenas o primeiro (suficiente p/ status)
  await saveItem(app, token, appId, 2, 1, { correct: true });
  await markStepCompleted(app, token, appId, 2);

  // Etapa 3: cronometrada (nomeação automática rápida)
  await saveItem(app, token, appId, 3, 1, { responseTimeMs: 12000 });
  await markStepCompleted(app, token, appId, 3);

  // Etapa 4: 20 itens
  await saveItem(app, token, appId, 4, 1, { correct: true });
  await markStepCompleted(app, token, appId, 4);
}

describe('Applications', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterEach(async () => {
    await prismaFrom(app).protocolStep.deleteMany({ where: { stepNumber: 99 } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria uma aplicação com status IN_PROGRESS e as 5 etapas na ordem', async () => {
    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const res = await request(app.getHttpServer())
      .post('/applications')
      .set(auth(user.accessToken))
      .send({ childId: child.id })
      .expect(201);

    expect(res.body.status).toBe('IN_PROGRESS');
    expect(res.body.steps).toHaveLength(4);
    expect(res.body.steps.map((s: any) => s.stepNumber)).toEqual([1, 2, 3, 4]);
    expect(res.body.currentStep).toBe(1);
  });

  it('mantém o estado de cada seção por aplicação e finaliza ao completar ou atingir cinco erros consecutivos', async () => {
    const prisma = prismaFrom(app);
    const stepNumber = 99;
    await prisma.protocolStep.deleteMany({ where: { stepNumber } });
    await prisma.protocolStep.create({
      data: {
        stepNumber,
        title: 'Etapa de teste',
        skill: 'teste',
        instructions: '',
        substeps: {
          create: [
            {
              order: 1,
              title: 'Seção completa',
              instructions: '',
              trainingExamples: JSON.stringify([]),
              items: {
                create: [1, 2].map((itemNumber) => ({
                  itemNumber,
                  isPending: false,
                  responseType: 'TEXT',
                })),
              },
            },
            {
              order: 2,
              title: 'Seção interrompida',
              instructions: '',
              trainingExamples: JSON.stringify([]),
              items: {
                create: Array.from({ length: 6 }, (_, index) => ({
                  itemNumber: index + 1,
                  isPending: false,
                  responseType: 'TEXT',
                })),
              },
            },
          ],
        },
      },
    });

    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const app1 = await createApplication(app, user.accessToken, child.id);
    const initialStep = app1.steps.find((s: any) => s.stepNumber === stepNumber);
    expect(initialStep.sections.map((section: any) => section.status)).toEqual([
      'NOT_STARTED',
      'NOT_STARTED',
    ]);
    const secondApplication = await createApplication(app, user.accessToken, child.id);
    const secondStep = secondApplication.steps.find((s: any) => s.stepNumber === stepNumber);
    expect(secondStep.sections.map((section: any) => section.status)).toEqual([
      'NOT_STARTED',
      'NOT_STARTED',
    ]);

    await saveItem(app, user.accessToken, app1.id, stepNumber, 1, { correct: false });
    let detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    expect(detail.body.steps.find((s: any) => s.stepNumber === stepNumber).sections[0].status)
      .toBe('IN_PROGRESS');

    await saveItem(app, user.accessToken, app1.id, stepNumber, 2, { correct: true });
    detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    expect(detail.body.steps.find((s: any) => s.stepNumber === stepNumber).sections[0]).toMatchObject({
      status: 'FINALIZED',
      finalizedReason: 'ALL_ITEMS_ANSWERED',
    });

    for (let itemNumber = 3; itemNumber <= 7; itemNumber += 1) {
      await saveItem(app, user.accessToken, app1.id, stepNumber, itemNumber, { correct: false });
    }
    detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    expect(detail.body.steps.find((s: any) => s.stepNumber === stepNumber).sections[1]).toMatchObject({
      status: 'FINALIZED',
      finalizedReason: 'ERROR_LIMIT',
    });
    // A seção encerrada não trava: dá para responder o item seguinte, e a
    // parada por erros continua valendo porque a sequência de cinco segue lá.
    await saveItem(app, user.accessToken, app1.id, stepNumber, 8, { correct: true })
      .then((res) => expect(res.status).toBe(201));
    detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    expect(detail.body.steps.find((s: any) => s.stepNumber === stepNumber).sections[1]).toMatchObject({
      status: 'FINALIZED',
      finalizedReason: 'ERROR_LIMIT',
    });

    // Corrigir uma resposta de uma seção já toda respondida também passa, e o
    // estado da seção acompanha: quebrada a sequência de erros, ela reabre.
    await saveItem(app, user.accessToken, app1.id, stepNumber, 5, { correct: true })
      .then((res) => expect(res.status).toBe(201));
    detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    expect(detail.body.steps.find((s: any) => s.stepNumber === stepNumber).sections[1]).toMatchObject({
      status: 'FINALIZED',
      finalizedReason: 'ALL_ITEMS_ANSWERED',
    });

    await request(app.getHttpServer())
      .post(`/applications/${app1.id}/steps/${stepNumber}/items/batch`)
      .set(auth(user.accessToken))
      .send({
        // O mesmo payload que o autosave reenvia: a resposta inteira, igual
        // à que já está gravada. Omitir childAnswer seria apagá-la, e aí a
        // recusa estaria correta.
        items: [
          { itemNumber: 1, childAnswer: 'errado', isCorrect: false },
          { itemNumber: 2, childAnswer: 'ok', isCorrect: true },
        ],
      })
      .expect(201);
  });

  it('isola aplicações entre avaliadores', async () => {
    const u1 = await registerAndLogin(app);
    const u2 = await registerAndLogin(app);
    const child = await createChild(app, u1.accessToken);
    const app1 = await createApplication(app, u1.accessToken, child.id);

    await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(u2.accessToken))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/applications/${app1.id}/steps/1/items`)
      .set(auth(u2.accessToken))
      .send({ itemNumber: 1, isCorrect: true })
      .expect(403);
  });

  it('salva respostas automaticamente e persiste no banco', async () => {
    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const app1 = await createApplication(app, user.accessToken, child.id);

    const res = await saveItem(app, user.accessToken, app1.id, 1, 1, { correct: true });
    expect(res.status).toBe(201);
    expect(res.body.item.isCorrect).toBe(true);
    expect(res.body.item.score).toBe(1);

    const detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    const step1 = detail.body.steps.find((s: any) => s.stepNumber === 1);
    expect(step1.items).toHaveLength(1);
    expect(step1.items[0].childAnswer).toBe('ok');
    expect(step1.score).toBe(1);
  });

  it('calcula as pontuações por etapa', async () => {
    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const app1 = await createApplication(app, user.accessToken, child.id);

    await saveItem(app, user.accessToken, app1.id, 1, 1, { correct: true });
    await saveItem(app, user.accessToken, app1.id, 1, 2, { correct: false });
    await saveItem(app, user.accessToken, app1.id, 1, 3, { correct: true });

    const detail = await request(app.getHttpServer())
      .get(`/applications/${app1.id}`)
      .set(auth(user.accessToken))
      .expect(200);
    const step1 = detail.body.steps.find((s: any) => s.stepNumber === 1);
    expect(step1.score).toBe(2);
  });

  it('finaliza a aplicação, calcula total e bloqueia edição', async () => {
    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const app1 = await createApplication(app, user.accessToken, child.id);
    await fullAnswer(app, user.accessToken, app1.id);

    const res = await request(app.getHttpServer())
      .post(`/applications/${app1.id}/complete`)
      .set(auth(user.accessToken))
      .send({})
      .expect(201);

    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.completedAt).toBeDefined();
    // 23 (etapa1) + 1 (etapa2) + 1 (etapa4)
    expect(res.body.totalScore).toBe(25);

    // bloqueio de edição após finalização
    await request(app.getHttpServer())
      .post(`/applications/${app1.id}/steps/1/items`)
      .set(auth(user.accessToken))
      .send({ itemNumber: 1, isCorrect: true })
      .expect(403);

    // reabertura explícita permite editar novamente
    await request(app.getHttpServer())
      .post(`/applications/${app1.id}/reopen`)
      .set(auth(user.accessToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/applications/${app1.id}/steps/1/items`)
      .set(auth(user.accessToken))
      .send({ itemNumber: 1, isCorrect: true })
      .expect(201);
  });

  it('bloqueia finalização com etapas incompletas sem confirmação explícita', async () => {
    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const app1 = await createApplication(app, user.accessToken, child.id);

    await saveItem(app, user.accessToken, app1.id, 1, 1, { correct: true });

    const res = await request(app.getHttpServer())
      .post(`/applications/${app1.id}/complete`)
      .set(auth(user.accessToken))
      .send({})
      .expect(400);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors.length).toBeGreaterThan(1);

    // com confirmação explícita, finaliza
    await request(app.getHttpServer())
      .post(`/applications/${app1.id}/complete`)
      .set(auth(user.accessToken))
      .send({ confirmIncomplete: true })
      .expect(201);
  });

  it('retorna o resultado detalhado com tempo da nomeação rápida', async () => {
    const user = await registerAndLogin(app);
    const child = await createChild(app, user.accessToken);
    const app1 = await createApplication(app, user.accessToken, child.id);
    await fullAnswer(app, user.accessToken, app1.id);

    const res = await request(app.getHttpServer())
      .get(`/applications/${app1.id}/result`)
      .set(auth(user.accessToken))
      .expect(200);

    expect(res.body.child.name).toBe(child.name);
    const step3 = res.body.steps.find((s: any) => s.stepNumber === 3);
    expect(step3.timerMs).toBe(12000);
    expect(res.body.steps).toHaveLength(4);
    expect(res.body.classification).toBeNull();
  });
});