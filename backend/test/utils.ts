import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';
import { randomUUID } from 'crypto';

export async function createTestingApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

export function uniqueEmail(): string {
  return `user-${randomUUID()}@papl.test`;
}

export interface TestUser {
  email: string;
  password: string;
  name: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerAndLogin(
  app: INestApplication,
  opts?: { verified?: boolean },
): Promise<TestUser> {
  const email = uniqueEmail();
  const password = 'Senha@123';
  const name = 'Avaliador de Teste';

  await request(app.getHttpServer())
    .post('/auth/register')
    .send({ name, email, password, confirmPassword: password, acceptTerms: true })
    .expect(201);

  if (opts?.verified !== false) {
    // modo dev: o e-mail de confirmação fica no MailLog
    const prisma = app.get(PrismaService);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    email,
    password,
    name,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function getMailLogBody(app: INestApplication, type: string) {
  const prisma = app.get(PrismaService);
  const mail = await prisma.mailLog.findFirst({
    where: { type },
    orderBy: { createdAt: 'desc' },
  });
  return mail?.body ?? '';
}

export async function createChild(app: INestApplication, token: string) {
  const res = await request(app.getHttpServer())
    .post('/children')
    .set(auth(token))
    .send({
      name: 'Criança Teste',
      birthDate: '2019-04-12',
      sex: 'F',
      school: 'EMEI Teste',
      grade: 'Pré I',
    })
    .expect(201);
  return res.body;
}

export async function createApplication(
  app: INestApplication,
  token: string,
  childId: string,
) {
  const res = await request(app.getHttpServer())
    .post('/applications')
    .set(auth(token))
    .send({ childId })
    .expect(201);
  return res.body;
}

export const prismaFrom = (app: INestApplication) => app.get(PrismaService);