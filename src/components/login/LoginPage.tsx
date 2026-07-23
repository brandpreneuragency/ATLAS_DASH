import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

/**
 * Product login (SPEC R5 / M2 map "Login"): the pre-auth gate outside the
 * six-area navigation. Submits to the existing `server/app/auth.py` cookie
 * session contract via `authStore`/`authApi` — no bearer tokens, no
 * client-side credential storage.
 */
export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);
  const login = useAuthStore((s) => s.login);
  const location = useLocation();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If a session already exists (e.g. user navigated back to /login while
    // logged in), resolve it so we can bounce straight to the app.
    if (status === 'unknown') void checkSession();
  }, [status, checkSession]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/work'} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !password) return;
    setSubmitting(true);
    setError(null);
    const result = await login(password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setPassword('');
      inputRef.current?.focus();
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== '/login' ? from : '/work', { replace: true });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: 'var(--c-background-1)',
      }}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          width: 300,
          padding: 28,
          borderRadius: 12,
          border: '1px solid var(--c-border-1)',
          background: 'var(--c-background-2)',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>
            ATLAS DASH
          </h1>
          <p className="subtle" style={{ margin: '4px 0 0', fontSize: 'var(--fs-sm)' }}>
            Sign in to continue
          </p>
        </div>

        <label
          htmlFor="login-password"
          style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)' }}
        >
          Password
        </label>
        <input
          id="login-password"
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={submitting}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--c-border-1)',
            background: 'var(--c-background-3, transparent)',
            color: 'var(--c-text-1)',
            fontSize: 'var(--fs-base)',
          }}
        />

        {error && (
          <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: 'var(--fs-xs)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting || !password}
          style={{ justifyContent: 'center', marginTop: 4 }}
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
