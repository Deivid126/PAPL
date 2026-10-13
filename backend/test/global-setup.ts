/* eslint-disable no-console */
/**
 * Cria o banco de testes (papl_test) e aplica o schema via Prisma.
 * Roda uma única vez antes da suíte de testes do Jest.
 */
import { execFileSync } from 'child_process';
import { Client } from 'pg';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://papl:papl@localhost:5432/papl_test?schema=public';

function parsePgUrl(url: string) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    database: u.pathname.replace(/^\//, '').split('?')[0],
  };
}

export default async function globalSetup(): Promise<void> {
  const { user, password, host, port, database } = parsePgUrl(TEST_DATABASE_URL);
  const admin = new Client({ host, port, user, password, database: 'postgres' });
  await admin.connect();
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [database],
  );
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database}"`);
    console.log(`Banco de testes criado: ${database}`);
  }
  await admin.end();

  process.env.DATABASE_URL = TEST_DATABASE_URL;
  console.log('Aplicando schema no banco de testes...');
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], {
    cwd: __dirname + '/..',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}