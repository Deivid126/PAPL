import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApplicationRunPage } from './ApplicationRunPage';

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

const protocolSteps = [
  {
    id: 'p1',
    stepNumber: 1,
    title: 'Conhecimento do alfabeto',
    skill: 'conhecimento_alfabeto',
    instructions: 'Instruções da etapa 1',
    maxScore: 23,
    timerRequired: false,
    position: 1,
    substeps: [
      {
        id: 'ps1',
        stepNumber: 1,
        order: 1,
        title: '1.1 Vogais',
        instructions: '',
        trainingExamples: ['Exemplo 1: I', 'Exemplo 2: O'],
        maxScore: 5,
        timerRequired: false,
        items: [
          {
            id: 'i1',
            substepId: 'ps1',
            itemNumber: 1,
            prompt: 'A',
            expectedAnswer: 'A',
            imageKey: null,
            isPending: false,
            responseType: 'LETTER',
          },
          {
            id: 'i2',
            substepId: 'ps1',
            itemNumber: 2,
            prompt: 'E',
            expectedAnswer: 'E',
            imageKey: null,
            isPending: false,
            responseType: 'LETTER',
          },
        ],
      },
    ],
  },
  {
    id: 'p2',
    stepNumber: 2,
    title: 'Habilidades metafonológicas',
    skill: 'habilidades_metafonologicas',
    instructions: 'Instruções da etapa 2',
    maxScore: 84,
    timerRequired: false,
    position: 2,
    substeps: [
      {
        id: 'ps2',
        stepNumber: 2,
        order: 1,
        title: '2.1 Síntese silábica',
        instructions: '',
        trainingExamples: [],
        maxScore: 21,
        timerRequired: false,
        items: [
          {
            id: 'i3',
            substepId: 'ps2',
            itemNumber: 1,
            prompt: null,
            expectedAnswer: null,
            imageKey: null,
            isPending: true,
            responseType: 'TEXT',
          },
        ],
      },
    ],
  },
];

function makeApp(stepNumber = 1) {
  return {
    id: 'app1',
    childId: 'c1',
    evaluatorId: 'u1',
    status: 'IN_PROGRESS',
    startedAt: '2026-09-01T00:00:00.000Z',
    completedAt: null,
    currentStep: stepNumber,
    totalScore: null,
    classification: null,
    notes: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    child: { id: 'c1', name: 'Ana Beatriz', birthDate: '2019-04-12', ageAtEvaluation: 6 },
    steps: [
      { id: 'as1', applicationId: 'app1', stepNumber: 1, skill: 'conhecimento_alfabeto', maxScore: 23, status: 'IN_PROGRESS', score: 0, startedAt: null, completedAt: null, notes: null, items: [] },
      { id: 'as2', applicationId: 'app1', stepNumber: 2, skill: 'habilidades_metafonologicas', maxScore: 84, status: 'NOT_STARTED', score: 0, startedAt: null, completedAt: null, notes: null, items: [] },
    ],
  };
}

function renderRun() {
  return render(
    <MemoryRouter initialEntries={['/applications/app1/run']}>
      <Routes>
        <Route path="/applications/:id/run" element={<ApplicationRunPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ApplicationRunPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('exibe os itens da etapa 1 e salva respostas', async () => {
    apiMocks.api.mockImplementation(async (url: string, _init?: RequestInit) => {
      if (url === '/applications/app1') return makeApp(1);
      if (url === '/protocol/steps') return protocolSteps;
      return {};
    });

    renderRun();

    await screen.findByRole('heading', { name: 'Conhecimento do alfabeto' });
    let choiceGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    expect(within(choiceGroup).getAllByRole('button')).toHaveLength(3);
    fireEvent.click(within(choiceGroup).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Próximo exemplo/ }));
    await screen.findByText(/Exemplo 2/);
    choiceGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    fireEvent.click(within(choiceGroup).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Ir para a prova/ }));
    choiceGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    expect(within(choiceGroup).getAllByRole('button')).toHaveLength(3);
    fireEvent.click(within(choiceGroup).getAllByRole('button')[0]);

    await waitFor(
      () =>
        expect(apiMocks.api).toHaveBeenCalledWith(
          '/applications/app1/steps/1/items/batch',
          expect.objectContaining({ method: 'POST' }),
        ),
      { timeout: 3000 },
    );
  });

  it('não envia a mesma resposta duas vezes quando os flushes se sobrepõem', async () => {
    const itemPosts: string[] = [];
    apiMocks.api.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/applications/app1') return makeApp(1);
      if (url === '/protocol/steps') return protocolSteps;
      if (url === '/applications/app1/steps/1/items/batch' && init?.method === 'POST') {
        const sent = JSON.parse(String(init.body)) as { items: unknown[] };
        for (const item of sent.items) itemPosts.push(JSON.stringify(item));
        // Latência maior que o debounce de 900ms de queueSave: o timer
        // dispara um segundo flush enquanto o primeiro ainda está na
        // rede. Sem serializar, esse segundo lê savedSignaturesRef antes
        // de o primeiro gravá-la e reenvia a mesma resposta.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return {};
      }
      return {};
    });

    renderRun();
    await screen.findByRole('heading', { name: 'Conhecimento do alfabeto' });

    // Responder agenda o salvamento por timer; avançar dispara um flush
    // direto. É a sobreposição dos dois que gerava a rajada.
    let choiceGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    fireEvent.click(within(choiceGroup).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Próximo exemplo/ }));
    await screen.findByText(/Exemplo 2/, undefined, { timeout: 8000 });
    choiceGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    fireEvent.click(within(choiceGroup).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Ir para a prova/ }));

    // Já na prova: responder chama setUnit, que agenda o salvamento por
    // timer. Prosseguir em seguida dispara um flush direto, que ainda
    // está na rede quando o timer vence.
    choiceGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    fireEvent.click(within(choiceGroup).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Prosseguir|Concluir etapa/ }));

    await waitFor(() => expect(itemPosts.length).toBeGreaterThan(0), { timeout: 8000 });
    // Deixa os timers pendentes de queueSave rodarem até o fim.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(itemPosts).toHaveLength(new Set(itemPosts).size);
  });

  it('navega entre as etapas após concluir', async () => {
    apiMocks.api.mockImplementation(async (url: string, _init?: RequestInit) => {
      if (url === '/applications/app1') return makeApp(1);
      if (url === '/protocol/steps') return protocolSteps;
      return {};
    });

    renderRun();

    await screen.findByRole('heading', { name: 'Conhecimento do alfabeto' });
    fireEvent.click(screen.getByRole('group', { name: 'Escolha uma letra' }).querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: /Próximo exemplo/ }));
    fireEvent.click(screen.getByRole('group', { name: 'Escolha uma letra' }).querySelector('button')!);
    fireEvent.click(screen.getByRole('button', { name: /Ir para a prova/ }));

    expect(await screen.findByText(/Item 1 de 2/)).toBeInTheDocument();
    const firstTestGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    fireEvent.click(within(firstTestGroup).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Prosseguir/ }));
    await screen.findByText(/Item 2 de 2/);
    const nextTestGroup = screen.getByRole('group', { name: 'Escolha uma letra' });
    expect(within(nextTestGroup).getAllByRole('button').every((button) => !button.className.includes('selected'))).toBe(true);
  });

  it('permite salvar e sair', async () => {
    apiMocks.api.mockImplementation(async (url: string, _init?: RequestInit) => {
      if (url === '/applications/app1') return makeApp(1);
      if (url === '/protocol/steps') return protocolSteps;
      return {};
    });

    renderRun();

    await screen.findByRole('heading', { name: 'Conhecimento do alfabeto' });
    fireEvent.click(screen.getByRole('button', { name: /Salvar e sair/ }));

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });
});