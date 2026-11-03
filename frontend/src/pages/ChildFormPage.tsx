import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Alert, Field, Spinner } from '../components/ui';
import type { Child } from '../lib/types';

/** Habilidades do DHACA, da primeira à quinta. */
export const DHACA_OPTIONS = [1, 2, 3, 4, 5] as const;

const DHACA_LABELS: Record<number, string> = {
  1: '1ª habilidade',
  2: '2ª habilidade',
  3: '3ª habilidade',
  4: '4ª habilidade',
  5: '5ª habilidade',
};

/**
 * Cadastro e edição de criança.
 *
 * A mesma tela serve aos dois: com :id na rota carrega o cadastro e envia
 * PATCH; sem :id, envia POST. Campo em branco na edição vira null, para o
 * avaliador conseguir limpar o que preencheu antes.
 */
export function ChildFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [doesNotRead, setDoesNotRead] = useState(false);
  const [dhaca, setDhaca] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingChild, setLoadingChild] = useState(isEdit);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const child = await api<Child>(`/children/${id}`);
        if (!active) return;
        setName(child.name);
        // birthDate vem ISO; o input type="date" só aceita AAAA-MM-DD.
        setBirthDate(child.birthDate.slice(0, 10));
        setSex(child.sex ?? '');
        setSchool(child.school ?? '');
        setGrade(child.grade ?? '');
        setNotes(child.notes ?? '');
        setDoesNotRead(child.doesNotRead);
        setDhaca(child.dhaca == null ? '' : String(child.dhaca));
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoadingChild(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  function validate() {
    const fe: Record<string, string> = {};
    if (name.trim().length < 2) fe.name = 'Informe o nome da criança.';
    if (!birthDate) fe.birthDate = 'Informe a data de nascimento.';
    else if (new Date(birthDate).getTime() > Date.now()) fe.birthDate = 'Data não pode ser no futuro.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      // Na edição, campo vazio precisa virar null para apagar o valor antigo;
      // no cadastro, undefined deixa o campo simplesmente fora do payload.
      const blank = isEdit ? null : undefined;
      const body = {
        name: name.trim(),
        birthDate,
        sex: sex || blank,
        school: school || blank,
        grade: grade || blank,
        notes: notes || blank,
        doesNotRead,
        dhaca: dhaca ? Number(dhaca) : blank,
      };
      if (isEdit) {
        await api(`/children/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        navigate(`/children/${id}`);
      } else {
        const res = await api<{ id: string }>('/children', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        navigate(`/children/${res.id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (loadingChild) {
    return (
      <div className="page">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to={isEdit ? `/children/${id}` : '/children'} className="btn btn-ghost btn-sm">
            ← {isEdit ? 'Voltar para a criança' : 'Lista de crianças'}
          </Link>
          <h1>{isEdit ? 'Editar criança' : 'Cadastrar criança'}</h1>
          <p className="page-subtitle">A idade é calculada automaticamente a partir da data de nascimento.</p>
        </div>
      </header>

      <section className="panel panel-narrow">
        {error && <Alert variant="error">{error}</Alert>}
        <form onSubmit={handleSubmit} className="form" noValidate>
          <Field label="Nome" htmlFor="name" error={fieldErrors.name}>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Data de nascimento"
            htmlFor="birthDate"
            error={fieldErrors.birthDate}
          >
            <input
              id="birthDate"
              className="input"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Sexo (opcional)" htmlFor="sex">
            <select id="sex" className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
              <option value="">Não informado</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="NÃO_INFORMADO">Prefiro não informar</option>
            </select>
          </Field>
          <Field label="DHACA (opcional)" htmlFor="dhaca">
            <select
              id="dhaca"
              className="input"
              value={dhaca}
              onChange={(e) => setDhaca(e.target.value)}
            >
              <option value="">Não informado</option>
              {DHACA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {DHACA_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Escola (opcional)" htmlFor="school">
            <input
              id="school"
              className="input"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
            />
          </Field>
          <Field label="Série (opcional)" htmlFor="grade">
            <input
              id="grade"
              className="input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
          </Field>
          <Field label="Observações (opcional)" htmlFor="notes">
            <textarea
              id="notes"
              className="input"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={doesNotRead}
              onChange={(e) => setDoesNotRead(e.target.checked)}
            />
            <span>Marcar se a criança ainda não sabe ler</span>
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Salvar criança'}
            </button>
            <Link className="btn btn-secondary" to={isEdit ? `/children/${id}` : '/children'}>
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
