/**
 * Garante que os testes usem o banco de testes, e não o de desenvolvimento.
 * Roda antes de cada arquivo de teste (mesmo processo do Jest).
 */
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://papl:papl@localhost:5432/papl_test?schema=public';
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret';
process.env.MAIL_DRIVER = 'dev';
process.env.BLOB_DRIVER = 'local';
process.env.BLOB_LOCAL_DIR = './test-storage';
process.env.BLOB_PUBLIC_BASE = 'http://localhost:3000';
process.env.CORS_ORIGIN = 'http://localhost:5173';