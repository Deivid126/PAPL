import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import type { Application, Child, ProtocolStep } from '../lib/types';
import { Alert, Field, Spinner } from '../components/ui';

export function NewApplicationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetChildId = params.get('childId') ?? '';

  const [children, setChildren] = useState<Child[]>([]);
  const [steps, setSteps] = useState<ProtocolStep[]>([]);
  const [mode, setMode] = useState<'select' | 'create'>(presetChildId ? 'select' : 'select');
  const [selectedChildId, setSelectedChildId] = useState(presetChildId);
  const [childId, setChildId] = useState(presetChildId);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // campos para criar criança
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [childNotes, setChildNotes] = useState('');

  const load = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const [childRes, stepRes] = await Promise.all([
        api<Child[]>('/children'),
        api<ProtocolStep[]>('/protocol/steps'),
      ]);
      setChildren(childRes);
      setSteps(stepRes);
      if (!presetChildId && childRes.length > 0) {
        setSelectedChildId(childRes[0].id);
        setChildId(childRes[0].id);
      }
    } finally {
      setLoadingChildren(false);
    }
  }, [presetChildId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? null;

  async function handleCreateChild() {
    if (name.trim().length < 2 || !birthDate) {
      setError('Informe o nome e a data de nascimento da nova criança.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api<Child>('/children', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          birthDate,
          sex: sex || undefined,
          school: school || undefined,
          grade: grade || undefined,
          notes: childNotes || undefined,
        }),
      });
      setChildId(res.id);
      setSelectedChildId(res.id);
      setChildren((prev) => [...prev, res]);
      setConfirming(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmStart() {
    if (!childId) {
      setError('Selecione ou cadastre uma criança para iniciar.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await api<Application>('/applications', {
        method: 'POST',
        body: JSON.stringify({ childId }),
      });
      navigate(`/applications/${res.id}/run`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  if (loadingChildren) return <Spinner label="Carregando dados" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/dashboard" className="btn btn-ghost btn-sm">
            ← Dashboard
          </Link>
          <h1>Nova aplicação</h1>
          <p className="page-subtitle">Selecione uma criança e confirme o início do protocolo.</p>
        </div>
      </header>

      {error && <Alert variant="error">{error}</Alert>}

      {!confirming ? (
        <div className="panel panel-narrow">
          <div className="segmented" role="tablist" aria-label="Forma de cadastro da criança">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'select'}
              className={`seg-btn${mode === 'select' ? ' active' : ''}`}
              onClick={() => setMode('select')}
            >
              Criança já cadastrada
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'create'}
              className={`seg-btn${mode === 'create' ? ' active' : ''}`}
              onClick={() => setMode('create')}
            >
              Cadastrar nova criança
            </button>
          </div>

          {mode === 'select' ? (
            <>
              {children.length === 0 ? (
                <Alert variant="info">
                  Nenhuma criança cadastrada. Cadastre uma nova criança para iniciar.
                </Alert>
              ) : (
                <Field label="Criança" htmlFor="child-select">
                  <select
                    id="child-select"
                    className="input"
                    value={selectedChildId}
                    onChange={(e) => {
                      setSelectedChildId(e.target.value);
                      setChildId(e.target.value);
                    }}
                  >
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.age}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {selectedChild && (
                <div className="confirm-box">
                  <p>
                    <strong>{selectedChild.name}</strong> • {selectedChild.age} •{' '}
                    {selectedChild.school ?? 'Escola não informada'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateChild();
              }}
            >
              <Field label="Nome da criança" htmlFor="name">
                <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label="Data de nascimento" htmlFor="birthDate">
                <input id="birthDate" className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
              </Field>
              <Field label="Sexo (opcional)" htmlFor="sex">
                <select id="sex" className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
              </Field>
              <Field label="Escola (opcional)" htmlFor="school">
                <input id="school" className="input" value={school} onChange={(e) => setSchool(e.target.value)} />
              </Field>
              <Field label="Série (opcional)" htmlFor="grade">
                <input id="grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </Field>
              <Field label="Observações iniciais (opcional)" htmlFor="childNotes">
                <textarea id="childNotes" className="input" rows={3} value={childNotes} onChange={(e) => setChildNotes(e.target.value)} />
              </Field>
              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={creating}>
                  {creating ? 'Cadastrando...' : 'Cadastrar e continuar'}
                </button>
              </div>
            </form>
          )}

          {mode === 'select' && (
            <div className="form-actions">
              <button
                className="btn btn-primary"
                type="button"
                disabled={!childId}
                onClick={() => setConfirming(true)}
              >
                Continuar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="panel panel-narrow">
          <h2>Confirmar início da aplicação</h2>
          {children.find((c) => c.id === childId) && (
            <div className="confirm-box">
              <p>
                <strong>Criança:</strong> {children.find((c) => c.id === childId)!.name} (
                {children.find((c) => c.id === childId)!.age})
              </p>
              <p>
                <strong>Ordem das habilidades:</strong>
              </p>
              <ol className="order-list">
                {steps.map((s) => (
                  <li key={s.stepNumber}>
                    {s.stepNumber}. {s.title}
                    {s.timerRequired ? ' (cronometrada)' : s.maxScore ? ` — ${s.maxScore} pts` : ''}
                  </li>
                ))}
              </ol>
              <Alert variant="info">
                As respostas serão salvas automaticamente a cada etapa. Você poderá sair e continuar depois.
              </Alert>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" type="button" onClick={handleConfirmStart} disabled={creating}>
              {creating ? 'Iniciando...' : 'Iniciar aplicação'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setConfirming(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}