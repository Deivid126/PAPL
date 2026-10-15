import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Child } from '../lib/types';
import { Alert, EmptyState, Spinner, StatusBadge } from '../components/ui';
import { IconArrowLeft, IconClipboard } from '../components/Icons';
import { formatDate, formatDateTime } from '../lib/format';

export function ChildDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [child, setChild] = useState<Child | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<Child>(`/children/${id}`);
      setChild(res);
      setError(null);
    } catch {
      setError('Não foi possível carregar os dados da criança.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Carregando criança" />;
  if (error || !child) {
    return (
      <div className="page">
        <Alert variant="error">{error ?? 'Criança não encontrada.'}</Alert>
        <Link className="btn btn-secondary" to="/children">
          <IconArrowLeft /> Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/children" className="btn btn-ghost btn-sm">
            <IconArrowLeft /> Lista de crianças
          </Link>
          <h1>{child.name}</h1>
          <p className="page-subtitle">
            {child.age} • {child.school ?? 'Escola não informada'} • {child.grade ?? 'Série não informada'}
          </p>
        </div>
        <div className="page-actions">
          <Link to={`/applications/new?childId=${child.id}`} className="btn btn-primary">
            <IconClipboard /> Nova aplicação
          </Link>
        </div>
      </header>

      <section className="detail-grid">
        <div className="panel">
          <h2>Dados da criança</h2>
          <dl className="detail-list">
            <div>
              <dt>Nome</dt>
              <dd>{child.name}</dd>
            </div>
            <div>
              <dt>Data de nascimento</dt>
              <dd>{formatDate(child.birthDate)}</dd>
            </div>
            <div>
              <dt>Idade</dt>
              <dd>{child.age}</dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>{child.sex ?? 'Não informado'}</dd>
            </div>
            <div>
              <dt>Escola</dt>
              <dd>{child.school ?? '—'}</dd>
            </div>
            <div>
              <dt>Série</dt>
              <dd>{child.grade ?? '—'}</dd>
            </div>
            <div>
              <dt>Cadastro</dt>
              <dd>{formatDateTime(child.createdAt)}</dd>
            </div>
            <div>
              <dt>Observações</dt>
              <dd>{child.notes ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Histórico de aplicações</h2>
          {!child.applications || child.applications.length === 0 ? (
            <EmptyState
              icon={<IconClipboard />}
              title="Nenhuma aplicação"
              description="Inicie a primeira aplicação do protocolo para esta criança."
            />
          ) : (
            <div className="history-list">
              {child.applications.map((app) => {
                const canContinue = app.status === 'IN_PROGRESS' || app.status === 'DRAFT';
                return (
                  <div className="history-item" key={app.id}>
                    <div className="history-item-main">
                      <div className="history-item-top">
                        <StatusBadge status={app.status} />
                        <span className="history-date">{formatDateTime(app.startedAt)}</span>
                      </div>
                      {app.completedAt && (
                        <p className="history-meta">Concluída em {formatDateTime(app.completedAt)}</p>
                      )}
                      {app.totalScore != null && (
                        <p className="history-meta">
                          Pontuação total: <strong>{app.totalScore}</strong>
                          {app.classification ? ` • ${app.classification}` : ''}
                        </p>
                      )}
                      {app.steps.length > 0 && (
                        <div className="step-score-list">
                          {app.steps.map((s) => (
                            <span key={s.id} className="step-score-chip" title={`Etapa ${s.stepNumber} — ${s.skill}`}>
                              {s.stepNumber}: {s.score}/{s.maxScore ?? '—'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="history-item-actions">
                      {canContinue && (
                        <Link to={`/applications/${app.id}/run`} className="btn btn-primary btn-sm">
                          Continuar aplicação
                        </Link>
                      )}
                      <Link
                        to={`/applications/${app.id}/result`}
                        className="btn btn-ghost btn-sm"
                      >
                        {app.status === 'COMPLETED' ? 'Ver resultado' : 'Ver andamento'}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="page-actions">
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!window.confirm(`Remover a criança "${child.name}" e todo o histórico?`)) return;
            await api(`/children/${child.id}`, { method: 'DELETE' });
            navigate('/children');
          }}
        >
          Remover criança
        </button>
      </div>
    </div>
  );
}