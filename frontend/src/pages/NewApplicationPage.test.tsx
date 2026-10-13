import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NewApplicationPage } from './NewApplicationPage';

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

const child = {
  id: 'c1',
  evaluatorId: 'u1',
  name: 'Ana Beatriz',
  birthDate: '2019-04-12',
  ageAtEvaluation: 6,
  age: '6 anos',
  sex: 'F',
  school: 'EMEI Teste',
  grade: 'Pré I',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const steps = [
  { id: 's1', stepNumber: 1, title: 'Conhecimento do alfabeto', skill: 'conhecimento_alfabeto', instructions: '', maxScore: 23, timerRequired: false, position: 1, substeps: [] },
  { id: 's2', stepNumber: 2, title: 'Habilidades metafonológicas', skill: 'habilidades_metafonologicas', instructions: '', maxScore: 84, timerRequired: false, position: 2, substeps: [] },
  { id: 's3', stepNumber: 3, title: 'Memória operacional fonológica', skill: 'memoria_operacional_fonologica', instructions: '', maxScore: 24, timerRequired: false, position: 3, substeps: [] },
  { id: 's4', stepNumber: 4, title: 'Nomeação automática rápida', skill: 'nomeacao_automatica_rapida', instructions: '', maxScore: null, timerRequired: true, position: 4, substeps: [] },
  { id: 's5', stepNumber: 5, title: 'Compreensão auditiva de sentenças', skill: 'compreensao_auditiva_sentencas', instructions: '', maxScore: 20, timerRequired: false, position: 5, substeps: [] },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/applications/new']}>
      <Routes>
        <Route path="/applications/new" element={<NewApplicationPage />} />
        <Route path="/applications/:id/run" element={<div>Página de aplicação</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NewApplicationPage', () => {
  it('inicia uma aplicação para a criança selecionada após confirmação', async () => {
    apiMocks.api.mockImplementation(async (url: string, _init?: RequestInit) => {
      if (url === '/children') return [child];
      if (url === '/protocol/steps') return steps;
      if (url === '/applications' && _init?.method === 'POST') {
        return { id: 'app1', childId: 'c1', status: 'IN_PROGRESS' };
      }
      return {};
    });

    renderPage();

    expect(await screen.findByText('Ana Beatriz — 6 anos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Confirmar início da aplicação')).toBeInTheDocument();
    expect(screen.getByText(/1\. Conhecimento do alfabeto/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar aplicação' }));

    await waitFor(() =>
      expect(apiMocks.api).toHaveBeenCalledWith(
        '/applications',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('c1') }),
      ),
    );
    expect(await screen.findByText('Página de aplicação')).toBeInTheDocument();
  });

  it('permite cadastrar uma nova criança durante a aplicação', async () => {
    apiMocks.api.mockImplementation(async (url: string, _init?: RequestInit) => {
      if (url === '/children' && !_init) return [];
      if (url === '/children' && _init?.method === 'POST') {
        return { ...child, id: 'c2', name: 'Bia' };
      }
      if (url === '/protocol/steps') return steps;
      return {};
    });

    renderPage();

    await screen.findByText('Cadastrar nova criança');
    fireEvent.click(screen.getByRole('tab', { name: 'Cadastrar nova criança' }));

    fireEvent.change(screen.getByLabelText('Nome da criança'), { target: { value: 'Bia' } });
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '2019-04-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar e continuar' }));

    await waitFor(() =>
      expect(apiMocks.api).toHaveBeenCalledWith(
        '/children',
        expect.objectContaining({ method: 'POST', body: expect.stringContaining('Bia') }),
      ),
    );
    expect(await screen.findByText('Confirmar início da aplicação')).toBeInTheDocument();
  });
});