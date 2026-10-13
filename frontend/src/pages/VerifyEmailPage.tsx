import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { Alert, Spinner } from '../components/ui';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        if (active) {
          setMessage(res.message);
          setState('success');
        }
      } catch (err) {
        if (active) {
          setMessage(errorMessage(err));
          setState('error');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark brand-mark-lg" aria-hidden="true">
            P
          </span>
          <h1>PAPL</h1>
        </div>
        <h2 className="auth-title">Confirmação de e-mail</h2>
        {state === 'loading' && <Spinner label="Confirmando" />}
        {state === 'success' && (
          <>
            <Alert variant="success">{message}</Alert>
            <Link className="btn btn-primary btn-block" to="/login">
              Ir para o login
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <Alert variant="error">{message}</Alert>
            <Link className="btn btn-primary btn-block" to="/login">
              Ir para o login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}