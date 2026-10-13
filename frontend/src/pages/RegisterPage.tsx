import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Alert, Field } from '../components/ui';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function validate() {
    const fe: Record<string, string> = {};
    if (name.trim().length < 3) fe.name = 'Informe seu nome completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fe.email = 'Informe um e-mail válido.';
    if (password.length < 8) fe.password = 'A senha deve ter no mínimo 8 caracteres.';
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password))
      fe.password = 'A senha deve conter letras e números.';
    if (confirmPassword !== password) fe.confirmPassword = 'As senhas não coincidem.';
    if (!acceptTerms) fe.acceptTerms = 'É necessário aceitar os termos.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email,
          password,
          confirmPassword,
          acceptTerms,
        }),
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-mark brand-mark-lg" aria-hidden="true">
              P
            </span>
            <h1>PAPL</h1>
          </div>
          <h2 className="auth-title">Cadastro concluído</h2>
          <Alert variant="success">
            Cadastro realizado com sucesso. O e-mail informado foi aceito e sua conta já está ativa.
          </Alert>
          <p className="auth-note">
            Você já pode entrar usando o e-mail e a senha cadastrados.
          </p>
          <Link className="btn btn-primary btn-block" to="/login">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg" aria-hidden="true">
            P
          </span>
          <h1>PAPL</h1>
          <p>Protocolo de Avaliação dos Preditores da Leitura na Pré-Escola</p>
        </div>

        <h2 className="auth-title">Criar conta</h2>
        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="form" noValidate>
          <Field label="Nome completo" htmlFor="name" error={fieldErrors.name}>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </Field>
          <Field label="E-mail" htmlFor="email" error={fieldErrors.email}>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Senha" htmlFor="password" error={fieldErrors.password}>
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
            label="Confirmação da senha"
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
          <div className="field">
            <label className="check-row">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <span>Li e aceito os termos de uso do sistema.</span>
            </label>
            {fieldErrors.acceptTerms && (
              <p className="field-error" role="alert">
                {fieldErrors.acceptTerms}
              </p>
            )}
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <p className="auth-links">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  );
}