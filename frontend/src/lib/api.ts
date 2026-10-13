import type { AuthTokens } from './types';

const TOKEN_KEY = 'papl_access_token';
const REFRESH_KEY = 'papl_refresh_token';
const USER_KEY = 'papl_user';

export function apiBase(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
}

export class ApiClientError extends Error {
  status: number;
  errors?: unknown;
  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): { id: string; name: string; email: string } | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; name: string; email: string };
  } catch {
    return null;
  }
}

export function storeAuth(tokens: AuthTokens): void {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(tokens.user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${apiBase()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as AuthTokens;
        storeAuth(data);
        return data.accessToken;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const token = await tryRefresh();
    if (token) {
      res = await rawFetch(path, init);
    } else {
      clearAuth();
    }
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ??
      `Erro inesperado (${res.status}).`;
    throw new ApiClientError(res.status, message, (body as { errors?: unknown })?.errors);
  }
  return body as T;
}

export async function apiRaw(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const token = await tryRefresh();
    if (token) {
      res = await rawFetch(path, init);
    } else {
      clearAuth();
    }
  }
  return res;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const data = await api<AuthTokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  storeAuth(data);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // ignora falha de logout
    }
  }
  clearAuth();
}

export function errorMessage(err: unknown): string {
  const raw = err instanceof ApiClientError || err instanceof Error ? err.message : '';
  if (/ThrottlerException|Too Many Requests|429/i.test(raw)) {
    return 'Muitas ações em sequência. Aguarde um instante e tente novamente.';
  }
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Erro inesperado. Tente novamente.';
}