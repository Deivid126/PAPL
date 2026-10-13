import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  auth,
  createChild,
  createApplication,
  createTestingApp,
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