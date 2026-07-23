import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Auth guard (SPEC R5 / AC5): gates every protected route behind the
 * argon2 + cookie session contract in `server/app/auth.py`, reused as-is
 * via `authApi`/`authStore` (GET /api/me).
 *
 * Protected content is never rendered while the session is unknown or
 * unauthenticated — only the `authenticated` branch renders `children`.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);
  const location = useLocation();

  useEffect(() => {
    if (status === 'unknown') void checkSession();
  }, [status, checkSession]);

  if (status === 'unknown') {
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
        <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
          Checking session...
        </span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
