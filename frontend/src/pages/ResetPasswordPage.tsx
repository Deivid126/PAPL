import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Alert, Field } from '../components/ui';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const fe: Record<string, string> = {};
    if (password.length < 8) fe.password = 'A senha deve ter no mínimo 8 caracteres.';
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password))
      fe.password = 'A senha deve conter letras e números.';
    if (confirmPassword !== password) fe.confirmPassword = 'As senhas não coincidem.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg" aria-hidden="true">
            P
          </span>
          <h1>PAPL</h1>
        </div>
        <h2 className="auth-title">Nova senha</h2>
        {message && (
          <>
            <Alert variant="success">{message}</Alert>
            <Link className="btn btn-primary btn-block" to="/login">
              Ir para o login
            </Link>
          </>
        )}
        {!message && (
          <>
            {error && <Alert variant="error">{error}</Alert>}
            <form onSubmit={handleSubmit} className="form" noValidate>
              <Field label="Nova senha" htmlFor="password" error={fieldErrors.password}>
                <input
                  id="password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <Field
                label="Confirmação da nova senha"
                htmlFor="confirmPassword"
                error={fieldErrors.confirmPassword}
              >
                <input
                  id="confirmPassword"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </Field>
              <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Definir nova senha'}
              </button>
            </form>
          </>
        )}
        <p className="auth-links">
          <Link to="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}