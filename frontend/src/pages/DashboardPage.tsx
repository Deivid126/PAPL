import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { Application, Child } from '../lib/types';
import { EmptyState, SelectField, Spinner, StatusBadge, useDebouncedValue } from '../components/ui';
import {
  IconCheckCircle,
  IconClipboard,
  IconPlus,
  IconSearch,
  IconUsers,
} from '../components/Icons';
import { formatDate } from '../lib/format';

interface DashboardData {
  children: Child[];
  applications: Application[];
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status !== 'all') params.set('status', status);
      params.set('sortBy', sortBy === 'name' ? 'name' : 'lastEvaluation');
      params.set('sortOrder', sortOrder);
      const [children, applications] = await Promise.all([
        api<Child[]>(`/children?${params.toString()}`),
        api<Application[]>('/applications'),
      ]);
      setData({ children, applications });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const apps = data?.applications ?? [];
    return {
      children: data?.children.length ?? 0,
      inProgress: apps.filter((a) => a.status === 'IN_PROGRESS').length,
      completed: apps.filter((a) => a.status === 'COMPLETED').length,
    };
  }, [data]);

  if (loading && !data) return <Spinner label="Carregando dashboard" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Olá, {user?.name?.split(' ')[0]}!</h1>
          <p className="page-subtitle">Acompanhe suas avaliações do protocolo PAPL.</p>
        </div>
        <div className="page-actions">
          <Link to="/applications/new" className="btn btn-primary">
            <IconPlus /> Nova aplicação
          </Link>
          <Link to="/children/new" className="btn btn-secondary">
            <IconPlus /> Cadastrar criança
          </Link>
        </div>
      </header>

      <section className="stats-grid" aria-label="Resumo">
        <div className="stat-card">
          <span className="stat-icon"><IconUsers /></span>
          <div>
            <span className="stat-value">{counts.children}</span>
            <span className="stat-label">Crianças cadastradas</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><IconClipboard /></span>
          <div>
            <span className="stat-value">{counts.inProgress}</span>
            <span className="stat-label">Aplicações em andamento</span>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><IconCheckCircle /></span>
          <div>
            <span className="stat-value">{counts.completed}</span>
            <span className="stat-label">Aplicações finalizadas</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Crianças avaliadas</h2>
        </div>

        <div className="toolbar">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true"><IconSearch /></span>
            <input
              className="input"
              type="search"
              placeholder="Buscar por nome"
              aria-label="Buscar criança por nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <SelectField id="filter-status" label="Status" value={status} onChange={setStatus}>
            <option value="all">Todos</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="COMPLETED">Finalizada</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ARCHIVED">Arquivada</option>
          </SelectField>
          <SelectField id="sort-by" label="Ordenar por" value={sortBy} onChange={setSortBy}>
            <option value="name">Nome</option>
            <option value="lastEvaluation">Última avaliação</option>
          </SelectField>
          <SelectField id="sort-order" label="Ordem" value={sortOrder} onChange={setSortOrder}>
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </SelectField>
        </div>

        {data && data.children.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title="Nenhuma criança cadastrada"
            description="Cadastre a primeira criança para iniciar uma avaliação do protocolo."
            action={
              <Link to="/children/new" className="btn btn-primary">
                <IconPlus /> Cadastrar criança
              </Link>
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Criança</th>
                  <th scope="col">Idade</th>
                  <th scope="col">Última avaliação</th>
                  <th scope="col">Status</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(data?.children ?? []).map((child) => {
                  const last = child.lastApplication;
                  const hasDraft = last && (last.status === 'IN_PROGRESS' || last.status === 'DRAFT');
                  return (
                    <tr key={child.id}>
                      <td>
                        <span className="child-name">{child.name}</span>
                        <span className="child-school">{child.school ?? ''}</span>
                      </td>
                      <td>{last ? child.age : child.age}</td>
                      <td>{last ? formatDate(last.startedAt) : '—'}</td>
                      <td>{last ? <StatusBadge status={last.status} /> : <span className="muted">Nunca avaliada</span>}</td>
                      <td>
                        {last?.classification ?? (last?.totalScore != null ? `${last.totalScore} pts` : '—')}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link to={`/children/${child.id}`} className="btn btn-ghost btn-sm">
                            Ver detalhes
                          </Link>
                          {hasDraft && last && (
                            <Link to={`/applications/${last.id}/run`} className="btn btn-primary btn-sm">
                              Continuar aplicação
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}