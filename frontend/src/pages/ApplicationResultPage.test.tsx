import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApplicationResultPage } from './ApplicationResultPage';

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

const result = {
  applicationId: 'app1',
  status: 'COMPLETED',
  startedAt: '2026-09-01T00:00:00.000Z',
  completedAt: '2026-09-01T01:00:00.000Z',
  currentStep: 5,
  totalScore: 25,
  maxScore: 172,
  classification: null,
  notes: 'Observação do avaliador.',
  child: { id: 'c1', name: 'Ana Beatriz', birthDate: '2019-04-12', ageAtEvaluation: 6, school: 'EMEI Teste', grade: 'Pré I' },
  steps: [
    { stepNumber: 1, skill: 'conhecimento_alfabeto', status: 'COMPLETED', score: 23, maxScore: 23, completedAt: null, timerMs: null, answeredItems: 23, notes: null },
    { stepNumber: 2, skill: 'habilidades_metafonologicas', status: 'COMPLETED', score: 1, maxScore: 84, completedAt: null, timerMs: null, answeredItems: 1, notes: null },
    { stepNumber: 3, skill: 'memoria_operacional_fonologica', status: 'COMPLETED', score: 0, maxScore: 24, completedAt: null, timerMs: null, answeredItems: 1, notes: null },
    { stepNumber: 4, skill: 'nomeacao_automatica_rapida', status: 'COMPLETED', score: 0, maxScore: null, completedAt: null, timerMs: 12000, answeredItems: 1, notes: null },
    { stepNumber: 5, skill: 'compreensao_auditiva_sentencas', status: 'COMPLETED', score: 1, maxScore: 20, completedAt: null, timerMs: null, answeredItems: 1, notes: null },
  ],
};

describe('ApplicationResultPage', () => {
  it('exibe pontuação total, tempo e detalhes por etapa', async () => {
    apiMocks.api.mockImplementation(async () => result);

    render(
      <MemoryRouter initialEntries={['/applications/app1/result']}>
        <Routes>
          <Route path="/applications/:id/result" element={<ApplicationResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Resultado da aplicação')).toBeInTheDocument();
    expect(screen.getByText(/Ana Beatriz/)).toBeInTheDocument();
    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12.00 s').length).toBeGreaterThan(0);
    expect(screen.getByText('Observação do avaliador.')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { hidden: false }).length).toBeGreaterThanOrEqual(4);
  });

  it('mostra perguntas respondidas e não respondidas sem misturar os exemplos', async () => {
    apiMocks.api.mockImplementation(async () => ({
      ...result,
      status: 'IN_PROGRESS',
      completedAt: null,
      steps: [
        {
          stepNumber: 1,
          skill: 'conhecimento_alfabeto',
          status: 'IN_PROGRESS',
          score: 1,
          maxScore: 4,
          completedAt: null,
          timerMs: null,
          answeredItems: 2,
          totalItems: 4,
          notes: null,
          substeps: [
            {
              order: 1,
              title: '1.1 Vogais',
              exampleCount: 2,
              examples: [
                { label: 'Exemplo 1', detail: null },
                { label: 'Exemplo 2', detail: null },
              ],
              totalItems: 4,
              answeredItems: 2,
              correctItems: 1,
              wrongItems: 1,
              items: [
                { itemNumber: 1, prompt: 'A', expectedAnswer: 'A', childAnswer: 'A', isCorrect: true, answered: true, notes: null },
                { itemNumber: 2, prompt: 'E', expectedAnswer: 'E', childAnswer: 'I', isCorrect: false, answered: true, notes: null },
                { itemNumber: 3, prompt: 'I', expectedAnswer: 'I', childAnswer: null, isCorrect: null, answered: false, notes: null },
                { itemNumber: 4, prompt: 'O', expectedAnswer: 'O', childAnswer: null, isCorrect: null, answered: false, notes: null },
              ],
            },
          ],
        },
      ],
    }));

    render(
      <MemoryRouter initialEntries={['/applications/app1/result']}>
        <Routes>
          <Route path="/applications/:id/result" element={<ApplicationResultPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Andamento da aplicação' })).toBeInTheDocument();
    expect(screen.getByText(/2 de 4 respondidas/)).toBeInTheDocument();
    expect(screen.getByText('Acerto')).toBeInTheDocument();
    expect(screen.getByText('Erro')).toBeInTheDocument();
    expect(screen.getAllByText('Não respondida')).toHaveLength(2);
    expect(screen.getByText(/2 exemplos, contados à parte/)).toBeInTheDocument();
  });
});