import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * Monta a aplicação Nest com pipes, filtros, CORS e Swagger.
 *
 * Compartilhado entre o servidor HTTP local (main.ts) e o handler
 * serverless da Vercel (api/index.js), para que os dois ambientes usem
 * exatamente a mesma configuração.
 */
export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  const config = app.get(ConfigService);

  const origins = (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidUnknownValues: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PAPL — API')
    .setDescription(
      'Protocolo de Avaliação dos Preditores da Leitura na Pré-Escola — documentação dos endpoints.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'PAPL — Documentação da API',
  });

  return app;
}
