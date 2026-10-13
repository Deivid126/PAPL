import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { auth, createChild, createTestingApp, registerAndLogin } from '../../test/utils';

describe('Children', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria uma criança com idade calculada automaticamente', async () => {
    const user = await registerAndLogin(app);
    const res = await request(app.getHttpServer())
      .post('/children')
      .set(auth(user.accessToken))
      .send({ name: 'Ana Beatriz', birthDate: '2019-04-12', sex: 'F' })
      .expect(201);
    expect(res.body.name).toBe('Ana Beatriz');
    expect(res.body.ageAtEvaluation).toBeGreaterThan(0);
  });

  it('lista apenas as crianças do próprio avaliador', async () => {
    const u1 = await registerAndLogin(app);
    const u2 = await registerAndLogin(app);
    await createChild(app, u1.accessToken);
    const mine = await createChild(app, u1.accessToken);
    await createChild(app, u2.accessToken);

    const list = await request(app.getHttpServer())
      .get('/children')
      .set(auth(u1.accessToken))
      .expect(200);
    expect(list.body.length).toBe(2);
    expect(list.body.map((c: any) => c.id)).toContain(mine.id);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set(auth(u1.accessToken))
      .expect(200);
    expect(list.body.every((c: any) => c.evaluatorId === me.body.id)).toBe(true);
  });

  it('não permite que outro avaliador veja a criança de outrem', async () => {
    const u1 = await registerAndLogin(app);
    const u2 = await registerAndLogin(app);
    const child = await createChild(app, u1.accessToken);

    await request(app.getHttpServer())
      .get(`/children/${child.id}`)
      .set(auth(u2.accessToken))
      .expect(403);
  });

  it('atualiza e remove criança com isolamento', async () => {
    const u1 = await registerAndLogin(app);
    const child = await createChild(app, u1.accessToken);

    const patched = await request(app.getHttpServer())
      .patch(`/children/${child.id}`)
      .set(auth(u1.accessToken))
      .send({ school: 'Nova Escola' })
      .expect(200);
    expect(patched.body.school).toBe('Nova Escola');

    await request(app.getHttpServer())
      .delete(`/children/${child.id}`)
      .set(auth(u1.accessToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/children/${child.id}`)
      .set(auth(u1.accessToken))
      .expect(404);
  });

  it('valida a data de nascimento', async () => {
    const user = await registerAndLogin(app);
    await request(app.getHttpServer())
      .post('/children')
      .set(auth(user.accessToken))
      .send({ name: 'Sem Data', birthDate: 'data-invalida' })
      .expect(400);
  });
});