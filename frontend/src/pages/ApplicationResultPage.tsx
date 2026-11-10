import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { ApplicationResult, ProgressSubstep } from '../lib/types';
import { Alert, Spinner, StatusBadge } from '../components/ui';
import { formatDate, formatDateTime, formatTimerMs } from '../lib/format';
import { countSyllables } from '../lib/syllableCircles';

/**
 * Janela de resposta da etapa: a primeira resposta da seção mais antiga e a
 * última mexida na seção mais recente. Derivada das seções para não repetir
 * a conta no servidor.
 */
function stepAnswerRange(step: { substeps?: ProgressSubstep[] }): {
  first: string | null;
  last: string | null;
} {
  const subs = step.substeps ?? [];
  const firsts = subs.map((sub) => sub.firstAnswerAt).filter((at): at is string => !!at);
  const lasts = subs.map((sub) => sub.lastAnswerAt).filter((at): at is string => !!at);
  return {
    first: firsts.length > 0 ? firsts.reduce((min, at) => (at < min ? at : min)) : null,
    last: lasts.length > 0 ? lasts.reduce((max, at) => (at > max ? at : max)) : null,
  };
}

/** Etapa 3 é a cronometrada: pontua por tempo, não por item. */
const TIMER_STEP = 3;

/**
 * Situação da seção, sem "finalizada": a seção não trava mais, então o que
 * interessa é quanto da prova foi respondido e se ela parou pela regra dos
 * cinco erros seguidos.
 */
function sectionSituation(sub: ProgressSubstep): string {
  if (sub.finalizedReason === 'ERROR_LIMIT') return 'Parou em 5 erros seguidos';
  if (sub.answeredItems === 0) return 'Não iniciada';
  if (sub.answeredItems >= sub.totalItems) return 'Respondida';
  return 'Em andamento';
}

const SKILL_LABELS: Record<string, string> = {
  conhecimento_alfabeto: 'Conhecimento do alfabeto',
  habilidades_metafonologicas: 'Habilidades metafonológicas',
  memoria_operacional_fonologica: 'Memória operacional fonológica',
  nomeacao_automatica_rapida: 'Nomeação automática rápida',
  compreensao_auditiva_sentencas: 'Compreensão auditiva de sentenças',
};

/**
 * Na segmentação silábica apresenta-se a palavra e espera-se as sílabas —
 * o inverso da síntese. As duas gravam nos mesmos campos (prompt e
 * expectedAnswer), seguindo a convenção da síntese, então aqui a ordem
 * precisa ser trocada para a tabela não mostrar um no lugar do outro.
 */
function apresentadoEEsperado(
  tituloDaSubetapa: string | undefined,
  item: { prompt?: string | null; expectedAnswer?: string | null; childAnswer?: string | null },
): { apresentado: string; esperado: string } {
  const apresentado = item.prompt ?? '—';
  const esperado = item.expectedAnswer ?? '—';
  if (/segmenta/i.test(tituloDaSubetapa ?? '') && /^\d+$/.test(item.childAnswer ?? '')) {
    const count = countSyllables(item.prompt);
    if (count > 0) {
      return {
        apresentado: esperado,
        esperado: `${count} ${count === 1 ? 'círculo' : 'círculos'}`,
      };
    }
  }
  return /segmenta/i.test(tituloDaSubetapa ?? '')
    ? { apresentado: esperado, esperado: apresentado }
    : { apresentado, esperado };
}

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

  const scoredSteps = result.steps.filter((s) => s.stepNumber !== TIMER_STEP);
  const timerStep = result.steps.find((s) => s.stepNumber === TIMER_STEP);

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
        <h2>Detalhes por etapa e seção</h2>
        <div className="table-responsive">
          <table className="table" aria-label="Detalhes por etapa e seção">
            <thead>
              <tr>
                <th scope="col">Etapa</th>
                <th scope="col">Habilidade</th>
                <th scope="col">Pontuação</th>
                <th scope="col">Itens respondidos</th>
                <th scope="col">Erros</th>
                <th scope="col">Tempo</th>
                <th scope="col">1ª resposta</th>
                <th scope="col">Última resposta</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.steps.map((s) => (
                <Fragment key={s.stepNumber}>
                  <tr className="result-row-step">
                    <td>{s.stepNumber}</td>
                    <td>{SKILL_LABELS[s.skill] ?? s.skill}</td>
                    <td>
                      <strong>{s.score}</strong>
                      {s.maxScore != null ? ` / ${s.maxScore}` : ''}
                    </td>
                    <td>
                      {s.totalItems != null ? `${s.answeredItems} de ${s.totalItems}` : s.answeredItems}
                    </td>
                    {/* Erros só da prova: os exemplos de treino não são
                        gravados e não entram nesta conta. */}
                    <td>
                      {s.stepNumber === TIMER_STEP
                        ? '—'
                        : (s.substeps ?? []).reduce((total, sub) => total + sub.wrongItems, 0)}
                    </td>
                    <td>{s.timerMs != null ? formatTimerMs(s.timerMs) : '—'}</td>
                    <td>{formatDateTime(stepAnswerRange(s).first)}</td>
                    <td>{formatDateTime(stepAnswerRange(s).last)}</td>
                    <td><StatusBadge status={s.status} /></td>
                  </tr>
                  {/* Uma linha por seção: a etapa sozinha esconde onde a
                      criança foi bem e onde parou. */}
                  {(s.substeps ?? []).map((sub) => (
                    <tr className="result-row-substep" key={`${s.stepNumber}.${sub.order}`}>
                      <td>{s.stepNumber}.{sub.order}</td>
                      <td>{sub.title.replace(/^\d+\.\d+\s*/, '')}</td>
                      <td>
                        {s.stepNumber === TIMER_STEP ? (
                          '—'
                        ) : (
                          <>
                            <strong>{sub.correctItems}</strong>
                            {` / ${sub.totalItems}`}
                          </>
                        )}
                      </td>
                      <td>{sub.answeredItems} de {sub.totalItems}</td>
                      <td>{s.stepNumber === TIMER_STEP ? '—' : sub.wrongItems}</td>
                      <td>{s.stepNumber === TIMER_STEP && s.timerMs != null ? formatTimerMs(s.timerMs) : '—'}</td>
                      <td>{formatDateTime(sub.firstAnswerAt)}</td>
                      <td>{formatDateTime(sub.lastAnswerAt)}</td>
                      <td>{sectionSituation(sub)}</td>
                    </tr>
                  ))}
                </Fragment>
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
                      Situação: {sectionSituation(sub)}
                      {sub.firstAnswerAt ? ` · 1ª resposta em ${formatDateTime(sub.firstAnswerAt)}` : ''}
                      {sub.lastAnswerAt ? ` · última em ${formatDateTime(sub.lastAnswerAt)}` : ''}
                      {!sub.firstAnswerAt ? ' · nenhuma resposta registrada' : ''}
                    </p>
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
                        {sub.items.map((item) => {
                          const col = apresentadoEEsperado(sub.title, item);
                          return (
                          <tr key={item.itemNumber}>
                            <td>{item.itemNumber}</td>
                            <td>{col.apresentado}</td>
                            <td>{col.esperado}</td>
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
                          );
                        })}
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