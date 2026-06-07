// Full-screen auth gate. Renders BEFORE the main app shell per the plan:
//
//   "Add a full-screen auth gate before AppLayout."
//
// The gate is responsible for:
//   * Showing a loading screen until the server is reachable.
//   * Routing to the right first-paint form (bootstrap / login / invite).
//   * Surfacing inline and topline errors from the auth store.
//
// The gate never touches Dexie, Tauri, or any non-auth endpoint.

import { useEffect, useState } from 'react';
import { LogIn, KeyRound, UserPlus, RefreshCw, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

type Mode = 'login' | 'invite';

function AuthHeader() {
  return (
    <div className="auth-gate-head">
      <div className="auth-gate-logo" aria-hidden>T</div>
      <h1 className="auth-gate-title">TABS</h1>
      <p className="auth-gate-subtitle">A focused workspace for writers and tasks.</p>
    </div>
  );
}

function ServerErrorView() {
  const { error, initialize, busy } = useAuthStore();
  return (
    <div className="auth-gate-form">
      <h2 className="auth-gate-h2">Server unreachable</h2>
      <p className="auth-gate-error" role="alert">{error ?? 'Cannot reach the TABS server.'}</p>
      <p className="auth-gate-hint">
        If you are running TABS locally, start the API with{' '}
        <code>npm run server:dev</code> in the project root. If you are on a fresh VPS
        deployment, the Caddy or API container may still be starting up.
      </p>
      <button
        type="button"
        className="btn btn--primary auth-gate-submit"
        onClick={() => { void initialize(); }}
        disabled={busy}
      >
        <RefreshCw size={14} />
        <span>{busy ? 'Checking…' : 'Retry'}</span>
      </button>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="auth-gate-form">
      <div className="auth-gate-spinner" aria-hidden />
      <p className="auth-gate-hint" style={{ textAlign: 'center' }}>Connecting to the TABS server…</p>
    </div>
  );
}

function LoginForm({ onSwitchToInvite }: { onSwitchToInvite: () => void }) {
  const { busy, error, login, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    await login({ email: email.trim(), password });
  };

  return (
    <form className="auth-gate-form" onSubmit={(e) => { void submit(e); }}>
      <h2 className="auth-gate-h2">Sign in</h2>
      {error && (
        <p className="auth-gate-error" role="alert">{error}</p>
      )}
      <label className="auth-gate-label">
        <span>Email</span>
        <input
          id="auth-email"
          className="ctrl auth-gate-input"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) clearError(); }}
          required
        />
      </label>
      <label className="auth-gate-label">
        <span>Password</span>
        <input
          id="auth-password"
          className="ctrl auth-gate-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) clearError(); }}
          required
        />
      </label>
      <button
        id="auth-login-submit"
        type="submit"
        className="btn btn--primary auth-gate-submit"
        disabled={busy || !email || !password}
      >
        <LogIn size={14} />
        <span>{busy ? 'Signing in…' : 'Sign in'}</span>
      </button>
      <div className="auth-gate-divider">
        <span>or</span>
      </div>
      <button
        type="button"
        className="auth-gate-link"
        onClick={onSwitchToInvite}
      >
        <KeyRound size={13} />
        <span>Sign up with an invite code</span>
      </button>
    </form>
  );
}

function InviteForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { busy, error, registerWithInvite, clearError } = useAuthStore();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const passwordsMatch = password.length === 0 || password === confirm;
  const strongEnough = password.length === 0 || password.length >= 8;
  const canSubmit =
    !busy &&
    code.trim().length > 0 &&
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    password.length >= 8 &&
    password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await registerWithInvite({
      inviteCode: code.trim(),
      email: email.trim(),
      displayName: displayName.trim(),
      password,
    });
  };

  return (
    <form className="auth-gate-form" onSubmit={(e) => { void submit(e); }}>
      <h2 className="auth-gate-h2">Create your account</h2>
      {error && (
        <p className="auth-gate-error" role="alert">{error}</p>
      )}
      <label className="auth-gate-label">
        <span>Invite code</span>
        <input
          id="auth-invite-code"
          className="ctrl auth-gate-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          placeholder="TABS-XXXXX-XXXXX"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); if (error) clearError(); }}
          required
        />
      </label>
      <label className="auth-gate-label">
        <span>Display name</span>
        <input
          id="auth-display-name"
          className="ctrl auth-gate-input"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); if (error) clearError(); }}
          required
        />
      </label>
      <label className="auth-gate-label">
        <span>Email</span>
        <input
          id="auth-invite-email"
          className="ctrl auth-gate-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) clearError(); }}
          required
        />
      </label>
      <label className="auth-gate-label">
        <span>Password</span>
        <input
          id="auth-invite-password"
          className="ctrl auth-gate-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) clearError(); }}
          required
          minLength={8}
        />
        {!strongEnough && (
          <span className="auth-gate-hint">At least 8 characters.</span>
        )}
      </label>
      <label className="auth-gate-label">
        <span>Confirm password</span>
        <input
          id="auth-invite-confirm"
          className="ctrl auth-gate-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); if (error) clearError(); }}
          required
        />
        {!passwordsMatch && (
          <span className="auth-gate-hint auth-gate-hint--error">Passwords do not match.</span>
        )}
      </label>
      <button
        id="auth-invite-submit"
        type="submit"
        className="btn btn--primary auth-gate-submit"
        disabled={!canSubmit}
      >
        <UserPlus size={14} />
        <span>{busy ? 'Creating account…' : 'Create account'}</span>
      </button>
      <button
        type="button"
        className="auth-gate-link"
        onClick={onSwitchToLogin}
      >
        Back to sign in
      </button>
    </form>
  );
}

function BootstrapForm() {
  const { busy, error, bootstrap, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const passwordsMatch = password.length === 0 || password === confirm;
  const strongEnough = password.length === 0 || password.length >= 8;
  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    password.length >= 8 &&
    password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await bootstrap({
      email: email.trim(),
      displayName: displayName.trim(),
      password,
    });
  };

  return (
    <form className="auth-gate-form" onSubmit={(e) => { void submit(e); }}>
      <h2 className="auth-gate-h2">Welcome — create the admin account</h2>
      <p className="auth-gate-hint">
        This is the first user on this server, so it will be the workspace
        administrator. You can create invite codes for other people once you
        are signed in.
      </p>
      {error && (
        <p className="auth-gate-error" role="alert">{error}</p>
      )}
      <label className="auth-gate-label">
        <span>Display name</span>
        <input
          id="auth-bootstrap-name"
          className="ctrl auth-gate-input"
          type="text"
          autoComplete="name"
          autoFocus
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); if (error) clearError(); }}
          required
        />
      </label>
      <label className="auth-gate-label">
        <span>Email</span>
        <input
          id="auth-bootstrap-email"
          className="ctrl auth-gate-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) clearError(); }}
          required
        />
      </label>
      <label className="auth-gate-label">
        <span>Password</span>
        <input
          id="auth-bootstrap-password"
          className="ctrl auth-gate-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); if (error) clearError(); }}
          required
          minLength={8}
        />
        {!strongEnough && (
          <span className="auth-gate-hint">At least 8 characters.</span>
        )}
      </label>
      <label className="auth-gate-label">
        <span>Confirm password</span>
        <input
          id="auth-bootstrap-confirm"
          className="ctrl auth-gate-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); if (error) clearError(); }}
          required
        />
        {!passwordsMatch && (
          <span className="auth-gate-hint auth-gate-hint--error">Passwords do not match.</span>
        )}
      </label>
      <button
        id="auth-bootstrap-submit"
        type="submit"
        className="btn btn--primary auth-gate-submit"
        disabled={!canSubmit}
      >
        <UserPlus size={14} />
        <span>{busy ? 'Creating account…' : 'Create admin account'}</span>
      </button>
    </form>
  );
}

function AuthenticatedGate() {
  // The `authenticated` phase is rendered by the AppLayout wrapper, not the
  // gate. We render an empty shell in case the gate is briefly mounted
  // before the parent switches it out.
  return <LoadingView />;
}

function InviteCreatedToast({ code, onDismiss }: { code: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / insecure context — fall through.
    }
  };
  return (
    <div className="auth-gate-invite" role="status">
      <div className="auth-gate-invite-head">
        <span className="auth-gate-hint" style={{ margin: 0 }}>New invite code</span>
        <button
          type="button"
          onClick={onDismiss}
          className="auth-gate-link"
          style={{ padding: 0 }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <code className="auth-gate-invite-code">{code}</code>
      <button
        type="button"
        className="btn auth-gate-invite-copy"
        onClick={() => { void handleCopy(); }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        <span>{copied ? 'Copied' : 'Copy code'}</span>
      </button>
      <p className="auth-gate-hint" style={{ margin: 0 }}>
        Send this code to the person you are inviting. They can paste it on
        the sign-in screen to create their account. The code works once.
      </p>
    </div>
  );
}

function AccountPanel() {
  // Mounted when the user IS signed in. The gate only shows this if the
  // parent renders us with `mode === 'account'` (i.e. it has not yet switched
  // back to AppLayout). In normal flow the AppLayout replaces us, so this is
  // a defensive fallback.
  return <AuthenticatedGate />;
}

export function AuthGate() {
  const phase = useAuthStore((s) => s.phase);
  const user = useAuthStore((s) => s.user);
  const error = useAuthStore((s) => s.error);
  const initialize = useAuthStore((s) => s.initialize);

  const [mode, setMode] = useState<Mode>('login');
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  useEffect(() => {
    if (phase === 'uninitialised') {
      void initialize();
    }
  }, [phase, initialize]);

  // If the user somehow becomes authenticated while the gate is mounted,
  // render an empty shell so the parent can swap us out cleanly.
  if (phase === 'authenticated' && user) {
    return <AccountPanel />;
  }

  let body: React.ReactNode = null;
  let switcher: React.ReactNode = null;

  if (phase === 'uninitialised' || phase === 'checking') {
    body = <LoadingView />;
  } else if (phase === 'error') {
    body = <ServerErrorView />;
  } else if (phase === 'noUsers') {
    body = <BootstrapForm />;
  } else if (phase === 'needsLogin') {
    if (mode === 'invite') {
      body = <InviteForm onSwitchToLogin={() => setMode('login')} />;
    } else {
      body = <LoginForm onSwitchToInvite={() => setMode('invite')} />;
    }
    switcher = (
      <div className="auth-gate-switcher" role="tablist" aria-label="Auth mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`auth-gate-switcher-btn${mode === 'login' ? ' auth-gate-switcher-btn--on' : ''}`}
          onClick={() => setMode('login')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'invite'}
          className={`auth-gate-switcher-btn${mode === 'invite' ? ' auth-gate-switcher-btn--on' : ''}`}
          onClick={() => setMode('invite')}
        >
          Use invite
        </button>
      </div>
    );
  } else {
    body = <LoadingView />;
  }

  return (
    <div className="auth-gate" role="dialog" aria-modal="true" aria-label="Authentication">
      <div className="auth-gate-card">
        <AuthHeader />
        {pendingInvite && (
          <InviteCreatedToast code={pendingInvite} onDismiss={() => setPendingInvite(null)} />
        )}
        {switcher}
        {body}
        {phase === 'needsLogin' && error && mode === 'login' && (
          // The form shows its own error inline; this is the case where the
          // store captured an error before any form interaction.
          <p className="auth-gate-hint" style={{ textAlign: 'center', marginTop: -8 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
