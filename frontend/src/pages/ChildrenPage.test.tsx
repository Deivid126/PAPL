import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChildrenPage } from './ChildrenPage';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Avaliador', email: 'a@papl.dev' },
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

const children = [
  {
    id: 'c1',
    evaluatorId: 'u1',
    name: 'Ana Beatriz',
    birthDate: '2019-04-12',
    ageAtEvaluation: 6,
    age: '6 anos',
    sex: 'F',
    school: 'EMEI A',
    grade: 'Pré I',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastApplication: null,
  },
  {
    id: 'c2',
    evaluatorId: 'u1',
    name: 'Pedro Henrique',
    birthDate: '2018-07-20',
    ageAtEvaluation: 7,
    age: '7 anos',
    sex: 'M',
    school: 'EMEI B',
    grade: 'Pré II',
    notes: null,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    lastApplication: {
      id: 'a2',
      status: 'COMPLETED',
      totalScore: 88,
      classification: null,
      startedAt: '2026-08-01T00:00:00.000Z',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentStep: 5,
    },
  },
];

describe('ChildrenPage', () => {
  it('lista as crianças e permite buscar por nome', async () => {
    apiMocks.api.mockImplementation(async () => children);

    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ana Beatriz')).toBeInTheDocument();
    expect(screen.getByText('Pedro Henrique')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ana' } });
    await waitFor(() => {
      expect(apiMocks.api).toHaveBeenCalledWith(expect.stringContaining('search=Ana'));
    });
  });

  it('exibe estado vazio', async () => {
    apiMocks.api.mockImplementation(async () => []);

    render(
      <MemoryRouter>
        <ChildrenPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nenhuma criança cadastrada')).toBeInTheDocument();
  });
});