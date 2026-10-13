import { ConfigService } from '@nestjs/config';
import { createNestApp } from './bootstrap';

async function bootstrap() {
  const app = await createNestApp();
  const config = app.get(ConfigService);

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`\nPAPL API rodando em http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger (API docs): http://localhost:${port}/docs`);
}

void bootstrap();
