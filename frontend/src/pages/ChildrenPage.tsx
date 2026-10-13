import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Child } from '../lib/types';
import { EmptyState, SelectField, Spinner, StatusBadge, useDebouncedValue } from '../components/ui';
import { IconPlus, IconSearch, IconUsers } from '../components/Icons';
import { formatDate } from '../lib/format';

export function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
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
      const res = await api<Child[]>(`/children?${params.toString()}`);
      setChildren(res);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && children.length === 0) return <Spinner label="Carregando crianças" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Crianças</h1>
          <p className="page-subtitle">Crianças cadastradas para avaliação.</p>
        </div>
        <div className="page-actions">
          <Link to="/children/new" className="btn btn-primary">
            <IconPlus /> Cadastrar criança
          </Link>
        </div>
      </header>

      <section className="panel">
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

        {children.length === 0 ? (
          <EmptyState
            icon={<IconUsers />}
            title="Nenhuma criança cadastrada"
            description="Cadastre a primeira criança para começar."
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
                  <th scope="col">Escola</th>
                  <th scope="col">Série</th>
                  <th scope="col">Última avaliação</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => {
                  const last = child.lastApplication;
                  const hasDraft = last && (last.status === 'IN_PROGRESS' || last.status === 'DRAFT');
                  return (
                    <tr key={child.id}>
                      <td>
                        <span className="child-name">{child.name}</span>
                      </td>
                      <td>{child.age}</td>
                      <td>{child.school ?? '—'}</td>
                      <td>{child.grade ?? '—'}</td>
                      <td>{last ? formatDate(last.startedAt) : '—'}</td>
                      <td>{last ? <StatusBadge status={last.status} /> : <span className="muted">—</span>}</td>
                      <td>
                        <div className="row-actions">
                          <Link to={`/children/${child.id}`} className="btn btn-ghost btn-sm">
                            Ver detalhes
                          </Link>
                          {hasDraft && last && (
                            <Link to={`/applications/${last.id}/run`} className="btn btn-primary btn-sm">
                              Continuar
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