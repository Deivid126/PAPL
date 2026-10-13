import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestingApp, uniqueEmail } from '../../test/utils';
import { PrismaService } from '../prisma/prisma.service';

describe('Auth', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestingApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const validUser = () => {
    const email = uniqueEmail();
    return { name: 'Maria Silva', email, password: 'Senha@123', confirmPassword: 'Senha@123', acceptTerms: true };
  };

  describe('Cadastro de usuário', () => {
    it('cria usuário com sucesso e não retorna senha', async () => {
      const data = validUser();
      const res = await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      expect(res.body.message).toContain('já pode entrar');
      const user = await prisma.user.findUniqueOrThrow({ where: { email: data.email } });
      expect(user.passwordHash).not.toContain(data.password);
      expect(user.emailVerifiedAt).not.toBeNull();
    });

    it('rejeita e-mail duplicado', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      const res = await request(app.getHttpServer()).post('/auth/register').send(data).expect(409);
      expect(res.body.message).toContain('já está cadastrado');
    });

    it('rejeita senha curta e confirmação divergente', async () => {
      const data = validUser();
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...data, password: 'curta', confirmPassword: 'outra' })
        .expect(400);
    });
  });

  describe('Confiança no e-mail informado', () => {
    it('ativa a conta imediatamente e permite login sem confirmação', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: data.email } });
      expect(user.emailVerifiedAt).not.toBeNull();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(200);
    });
  });

  describe('Login', () => {
    it('faz login e retorna access + refresh token', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      await prisma.user.update({
        where: { email: data.email },
        data: { emailVerifiedAt: new Date() },
      });
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(data.email);
    });

    it('rejeita senha inválida', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      await prisma.user.update({
        where: { email: data.email },
        data: { emailVerifiedAt: new Date() },
      });
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: 'SenhaErrada1' })
        .expect(401);
    });

    it('renova tokens via refresh', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      await prisma.user.update({
        where: { email: data.email },
        data: { emailVerifiedAt: new Date() },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(200);
      const refresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);
      expect(refresh.body.accessToken).toBeDefined();
      expect(refresh.body.refreshToken).toBeDefined();
    });

    it('logout revoga o refresh token', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      await prisma.user.update({
        where: { email: data.email },
        data: { emailVerifiedAt: new Date() },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });

  describe('Recuperação de senha', () => {
    it('envia token e redefine a senha', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      await prisma.user.update({
        where: { email: data.email },
        data: { emailVerifiedAt: new Date() },
      });

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: data.email })
        .expect(200);

      const mail = await prisma.mailLog.findFirstOrThrow({
        where: { type: 'password-reset' },
        orderBy: { createdAt: 'desc' },
      });
      const token = mail.body.match(/reset-password\?token=([^\s]+)/)?.[1];
      expect(token).toBeDefined();

      const newPassword = 'NovaSenha@99';
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: newPassword, confirmPassword: newPassword })
        .expect(200);

      // senha antiga não funciona mais
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(401);

      // nova senha funciona
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: newPassword })
        .expect(200);

      // token invalidado após uso
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: newPassword, confirmPassword: newPassword })
        .expect(400);
    });

    it('não revela se o e-mail existe', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nao-existe@papl.test' })
        .expect(200);
      expect(res.body.message).toContain('Se o e-mail estiver cadastrado');
    });
  });

  describe('Rotas protegidas', () => {
    it('recusa acesso sem token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('aceita acesso com token válido', async () => {
      const data = validUser();
      await request(app.getHttpServer()).post('/auth/register').send(data).expect(201);
      await prisma.user.update({
        where: { email: data.email },
        data: { emailVerifiedAt: new Date() },
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: data.email, password: data.password })
        .expect(200);
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body.email).toBe(data.email);
    });
  });
});