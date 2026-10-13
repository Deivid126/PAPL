import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, errorMessage } from '../lib/api';
import { Alert, Field } from '../components/ui';
import { formatDateTime } from '../lib/format';
import type { User } from '../lib/types';

export function ProfilePage() {
  const { refreshUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const me = await api<User>('/auth/me');
        setUser(me);
        setName(me.name);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ id: string; name: string; email: string }>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim() }),
      });
      setName(res.name);
      setMessage('Perfil atualizado com sucesso.');
      await refreshUser();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (loading) {
    return (
      <div className="page">
        <h1>Perfil</h1>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Perfil do avaliador</h1>
          <p className="page-subtitle">Gerencie seus dados de conta.</p>
        </div>
      </header>

      <section className="panel panel-narrow">
        {message && <Alert variant="success">{message}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}

        <dl className="detail-list">
          <div>
            <dt>E-mail</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>E-mail cadastrado</dt>
            <dd>{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Conta criada em</dt>
            <dd>{user ? formatDateTime(user.createdAt) : '—'}</dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} className="form">
          <Field label="Nome completo" htmlFor="name">
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Salvar alterações
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}