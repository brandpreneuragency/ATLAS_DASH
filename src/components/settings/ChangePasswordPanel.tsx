import { useState } from 'react';
import { authApi } from '../../services/authApi';

/**
 * Settings -> System -> Password (F10).
 *
 * Until this shipped there was no way to rotate the product password except by
 * editing the `password_hash` settings row in SQLite by hand. That became a
 * real problem at CP-M5 (2026-07-24), when Caddy basic-auth was removed and
 * this password became the only gate on a public host that exposes a VPS
 * shell, file writes and a kill switch.
 *
 * Nothing typed here is stored, logged or echoed back: the fields are cleared
 * on success, and validation messages come from the backend rather than being
 * reworded here, so the rules cannot drift between the two.
 */
export function ChangePasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    const result = await authApi.changePassword(current, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCurrent('');
    setNext('');
    setConfirm('');
    setDone(true);
  };

  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h3 style={{ margin: 0, fontSize: 'var(--fs-base)' }}>Change password</h3>
      <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
        This is the password that signs you in to ATLAS DASH. Changing it signs out every
        other browser and device — any session opened with the old password stops working
        immediately. You stay signed in here.
      </p>

      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Current password
        <input
          type="password"
          autoComplete="current-password"
          className="ctrl w-full"
          style={{ fontSize: 'var(--fs-sm)' }}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </label>

      <label style={{ fontSize: 'var(--fs-sm)' }}>
        New password
        <input
          type="password"
          autoComplete="new-password"
          className="ctrl w-full"
          style={{ fontSize: 'var(--fs-sm)' }}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </label>

      <label style={{ fontSize: 'var(--fs-sm)' }}>
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          className="ctrl w-full"
          style={{ fontSize: 'var(--fs-sm)' }}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      {error && (
        <p role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c', margin: 0 }}>
          {error}
        </p>
      )}
      {done && (
        <p role="status" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
          Password changed. Other sessions have been signed out.
        </p>
      )}

      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
