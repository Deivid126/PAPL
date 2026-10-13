import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Avaliador Teste', email: 'a@papl.dev' },
    loading: false,
    refreshUser: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    error: null,
  }),
}));

const apiMocks = vi.hoisted(() => ({
  api: vi.fn(async (_url: string, _init?: RequestInit) => ({})),
  apiRaw: vi.fn(async () => new Response()),
  login: vi.fn(async () => ({
    accessToken: 'token',
    refreshToken: 'refresh',
    accessExpiresIn: 900,
    refreshExpiresIn: 604800,
    user: { id: 'u1', name: 'Avaliador', email: 'a@papl.dev', emailVerifiedAt: null },
  })),
  logout: vi.fn(async () => undefined),
  errorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Erro'),
  getAccessToken: vi.fn(() => 'token'),
  getRefreshToken: vi.fn(() => 'refresh'),
  getStoredUser: vi.fn(() => ({ id: 'u1', name: 'Avaliador', email: 'a@papl.dev' })),
  storeAuth: vi.fn(),
  clearAuth: vi.fn(),
  apiBase: () => '/api',
  ApiClientError: class ApiClientError extends Error {
    status = 0;
    errors?: unknown;
    constructor(status: number, message: string, errors?: unknown) {
      super(message);
      this.status = status;
      this.errors = errors;
    }
  },
}));

vi.mock('../lib/api', () => apiMocks);

const child = {
  id: 'c1',
  evaluatorId: 'u1',
  name: 'Ana Beatriz',
  birthDate: '2019-04-12',
  ageAtEvaluation: 6,
  age: '6 anos e 5 meses',
  sex: 'F',
  school: 'EMEI Teste',
  grade: 'Pré I',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastApplication: {
    id: 'a1',
    status: 'IN_PROGRESS',
    totalScore: null,
    classification: null,
    startedAt: '2026-09-01T00:00:00.000Z',
    completedAt: null,
    currentStep: 2,
  },
};

describe('DashboardPage', () => {
  it('exibe saudação, contagens e a criança avaliada', async () => {
    apiMocks.api.mockImplementation(async (url: string) => {
      if (url.startsWith('/children')) return [child];
      if (url.startsWith('/applications')) return [
        { ...child, id: 'a1', childId: 'c1', status: 'IN_PROGRESS', steps: [] },
      ];
      return {};
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Olá, Avaliador/)).toBeInTheDocument();
    expect(await screen.findByText('Ana Beatriz')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Nova aplicação/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cadastrar criança/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continuar aplicação/ })).toBeInTheDocument();
  });

  it('exibe estado vazio quando não há crianças', async () => {
    apiMocks.api.mockImplementation(async (url: string) => {
      if (url.startsWith('/children')) return [];
      if (url.startsWith('/applications')) return [];
      return {};
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText('Nenhuma criança cadastrada')).toBeInTheDocument(),
    );
  });
});