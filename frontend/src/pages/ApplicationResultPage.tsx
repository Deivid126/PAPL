import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { ApplicationResult } from '../lib/types';
import { Alert, Spinner, StatusBadge } from '../components/ui';
import { formatDate, formatTimerMs } from '../lib/format';

const SKILL_LABELS: Record<string, string> = {
  conhecimento_alfabeto: 'Conhecimento do alfabeto',
  habilidades_metafonologicas: 'Habilidades metafonológicas',
  memoria_operacional_fonologica: 'Memória operacional fonológica',
  nomeacao_automatica_rapida: 'Nomeação automática rápida',
  compreensao_auditiva_sentencas: 'Compreensão auditiva de sentenças',
};

export function ApplicationResultPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ApplicationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<ApplicationResult>(`/applications/${id}/result`);
      setResult(res);
    } catch {
      setError('Não foi possível carregar o resultado.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Carregando resultado" />;

  if (error || !result) {
    return (
      <div className="page">
        <Alert variant="error">{error ?? 'Resultado não encontrado.'}</Alert>
        <Link className="btn btn-secondary" to="/dashboard">
          Voltar ao dashboard
        </Link>
      </div>
    );
  }

  const scoredSteps = result.steps.filter((s) => s.stepNumber !== 3);
  const timerStep = result.steps.find((s) => s.stepNumber === 3);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{result.status === 'COMPLETED' ? 'Resultado da aplicação' : 'Andamento da aplicação'}</h1>
          <p className="page-subtitle">
            {result.child.name} • {result.child.age ?? `${result.child.ageAtEvaluation} anos`} •{' '}
            {result.completedAt ? new Date(result.completedAt).toLocaleString('pt-BR') : formatDate(result.startedAt)}
          </p>
        </div>
        <div className="page-actions">
          <Link to={`/children/${result.child.id}`} className="btn btn-secondary">
            Ver criança
          </Link>
        </div>
      </header>

      <section className="result-summary">
        <div className="stat-card">
          <div>
            <span className="stat-value">{result.totalScore ?? '—'}</span>
            <span className="stat-label">Pontuação total</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <span className="stat-value">{result.maxScore}</span>
            <span className="stat-label">Pontuação máxima</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <span className="stat-value">{timerStep?.timerMs != null ? formatTimerMs(timerStep.timerMs) : '—'}</span>
            <span className="stat-label">Nomeação automática rápida</span>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <span className="stat-value">{result.classification ?? 'Não configurada'}</span>
            <span className="stat-label">Classificação</span>
          </div>
        </div>
      </section>

      {result.classification && (
        <section className="panel">
          <StatusBadge status={result.status} />
          <p className="classification-note">
            Classificação atribuída conforme a regra configurada no protocolo.
          </p>
        </section>
      )}

      <section className="panel">
        <h2>Pontuação por habilidade</h2>
        <Chart steps={scoredSteps} />
      </section>

      <section className="panel">
        <h2>Detalhes por etapa</h2>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Etapa</th>
                <th scope="col">Habilidade</th>
                <th scope="col">Pontuação</th>
                <th scope="col">Itens respondidos</th>
                <th scope="col">Tempo</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.steps.map((s) => (
                <tr key={s.stepNumber}>
                  <td>{s.stepNumber}</td>
                  <td>{SKILL_LABELS[s.skill] ?? s.skill}</td>
                  <td>
                    <strong>{s.score}</strong>
                    {s.maxScore != null ? ` / ${s.maxScore}` : ''}
                  </td>
                  <td>
                    {s.totalItems != null ? `${s.answeredItems} de ${s.totalItems}` : s.answeredItems}
                  </td>
                  <td>{s.timerMs != null ? formatTimerMs(s.timerMs) : '—'}</td>
                  <td>{s.status === 'COMPLETED' ? 'Concluída' : s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="item-details">
          <h2>O que já foi feito</h2>
          <p className="notes-text">
            Cada pergunta da prova aparece aqui, respondida ou não. Os exemplos de treino ficam separados e não entram na conta nem na pontuação.
          </p>
          {result.steps.map((s) => (
            <div className="item-details-step" key={s.stepNumber}>
              <h3>{s.stepNumber}. {SKILL_LABELS[s.skill] ?? s.skill}</h3>
              {(s.substeps ?? []).length > 0 ? (
                s.substeps?.map((sub) => (
                  <div className="progress-substep" key={sub.order}>
                    <h4>{sub.title}</h4>
                    <p className="progress-count">
                      Prova: {sub.answeredItems} de {sub.totalItems} respondidas
                      {' · '}
                      {sub.correctItems} {sub.correctItems === 1 ? 'acerto' : 'acertos'}
                      {' · '}
                      {sub.wrongItems} {sub.wrongItems === 1 ? 'erro' : 'erros'}
                      {' · '}
                      {sub.totalItems - sub.answeredItems} não {sub.totalItems - sub.answeredItems === 1 ? 'respondida' : 'respondidas'}
                    </p>
                    {sub.exampleCount > 0 && (
                      <div className="example-box">
                        <p>
                          Treino: {sub.exampleCount} {sub.exampleCount === 1 ? 'exemplo' : 'exemplos'}, contados à parte e sem pontuação.
                        </p>
                        <ul>
                          {sub.examples.map((example) => (
                            <li key={example.label}>
                              {example.label}
                              {example.detail ? ` — ${example.detail}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Teste</th>
                          <th scope="col">Apresentado</th>
                          <th scope="col">Esperado</th>
                          <th scope="col">Resposta</th>
                          <th scope="col">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sub.items.map((item) => (
                          <tr key={item.itemNumber}>
                            <td>{item.itemNumber}</td>
                            <td>{item.prompt ?? '—'}</td>
                            <td>{item.expectedAnswer ?? '—'}</td>
                            <td>{item.answered ? item.childAnswer || '—' : '—'}</td>
                            <td>
                              {!item.answered ? (
                                <span className="item-pending">Não respondida</span>
                              ) : item.isCorrect === true ? (
                                <strong className="item-correct">Acerto</strong>
                              ) : item.isCorrect === false ? (
                                <strong className="item-wrong">Erro</strong>
                              ) : (
                                <span className="item-pending">Respondida</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (s.items ?? []).length === 0 ? (
                <p className="notes-text">Nenhum item registrado.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Apresentado</th>
                      <th scope="col">Esperado</th>
                      <th scope="col">Resposta da criança</th>
                      <th scope="col">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.items ?? []).map((i) => (
                      <tr key={i.itemNumber}>
                        <td>{i.itemNumber}</td>
                        <td>{i.prompt ?? '—'}</td>
                        <td>{i.expectedAnswer ?? '—'}</td>
                        <td>{i.childAnswer || '—'}</td>
                        <td>
                          {i.isCorrect === true ? (
                            <strong className="item-correct">Acerto</strong>
                          ) : i.isCorrect === false ? (
                            <strong className="item-wrong">Erro</strong>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </section>

      {result.notes && (
        <section className="panel">
          <h2>Observações do avaliador</h2>
          <p className="notes-text">{result.notes}</p>
        </section>
      )}

      <div className="page-actions">
        <Link to={`/applications/${id}/run`} className="btn btn-secondary">
          {result.status === 'COMPLETED' ? 'Reabrir / revisar aplicação' : 'Continuar de onde parou'}
        </Link>
        <Link to="/dashboard" className="btn btn-primary">
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}

function Chart({ steps }: { steps: ApplicationResult['steps'] }) {
  const max = Math.max(1, ...steps.map((s) => s.maxScore ?? s.score));
  return (
    <div className="chart">
      {steps.map((s) => {
        const pct = ((s.maxScore ?? max) > 0 ? (s.score / (s.maxScore ?? max)) * 100 : 0);
        return (
          <div className="chart-row" key={s.stepNumber}>
            <span className="chart-label" title={SKILL_LABELS[s.skill] ?? s.skill}>
              {s.stepNumber}. {SKILL_LABELS[s.skill]?.split(' ')[0] ?? s.skill}
            </span>
            <div className="chart-track" role="img" aria-label={`${SKILL_LABELS[s.skill] ?? s.skill}: ${s.score} de ${s.maxScore ?? 'máx'} pontos`}>
              <div
                className="chart-bar"
                style={{ width: `${Math.min(100, Math.round(pct))}%` }}
              />
            </div>
            <span className="chart-value">
              {s.score}/{s.maxScore ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}