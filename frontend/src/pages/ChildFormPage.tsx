import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Alert, Field } from '../components/ui';

export function ChildFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [doesNotRead, setDoesNotRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
      const res = await api<{ id: string }>('/children', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          birthDate,
          sex: sex || undefined,
          school: school || undefined,
          grade: grade || undefined,
          notes: notes || undefined,
          doesNotRead,
        }),
      });
      navigate(`/children/${res.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/children" className="btn btn-ghost btn-sm">
            ← Lista de crianças
          </Link>
          <h1>Cadastrar criança</h1>
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
              {loading ? 'Salvando...' : 'Salvar criança'}
            </button>
            <Link className="btn btn-secondary" to="/children">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}