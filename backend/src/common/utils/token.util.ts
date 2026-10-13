import { createHash, randomBytes } from 'crypto';

/**
 * Gera um token aleatório seguro e retorna o token em claro (para enviar
 * por e-mail) junto com o hash a ser armazenado no banco.
 * Nunca armazenamos o token em claro.
 */
export function generateOpaqueToken(bytes = 32): {
  token: string;
  hash: string;
} {
  const token = randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}