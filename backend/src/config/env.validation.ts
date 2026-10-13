export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: number;
  JWT_REFRESH_EXPIRES_IN: number;
  EMAIL_TOKEN_EXPIRES_IN: number;
  PASSWORD_TOKEN_EXPIRES_IN: number;
  CORS_ORIGIN: string;
  MAIL_DRIVER: 'dev' | 'smtp';
  BLOB_DRIVER: 'local' | 's3' | 'azure';
  BLOB_LOCAL_DIR: string;
  BLOB_PUBLIC_BASE: string;
}

const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  for (const key of REQUIRED) {
    if (!config[key]) {
      throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
    }
  }
  return {
    PORT: Number(config.PORT ?? 3000),
    NODE_ENV: String(config.NODE_ENV ?? 'development'),
    DATABASE_URL: String(config.DATABASE_URL),
    JWT_ACCESS_SECRET: String(config.JWT_ACCESS_SECRET),
    JWT_REFRESH_SECRET: String(config.JWT_REFRESH_SECRET),
    JWT_ACCESS_EXPIRES_IN: Number(config.JWT_ACCESS_EXPIRES_IN ?? 900),
    JWT_REFRESH_EXPIRES_IN: Number(config.JWT_REFRESH_EXPIRES_IN ?? 604800),
    EMAIL_TOKEN_EXPIRES_IN: Number(config.EMAIL_TOKEN_EXPIRES_IN ?? 86400),
    PASSWORD_TOKEN_EXPIRES_IN: Number(config.PASSWORD_TOKEN_EXPIRES_IN ?? 3600),
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? 'http://localhost:5173'),
    MAIL_DRIVER: (config.MAIL_DRIVER ?? 'dev') as 'dev' | 'smtp',
    BLOB_DRIVER: (config.BLOB_DRIVER ?? 'local') as 'local' | 's3' | 'azure',
    BLOB_LOCAL_DIR: String(config.BLOB_LOCAL_DIR ?? './storage'),
    BLOB_PUBLIC_BASE: String(config.BLOB_PUBLIC_BASE ?? 'http://localhost:3000'),
  };
}