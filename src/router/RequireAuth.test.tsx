import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth';
import { useAuthStore } from '../stores/authStore';

// Mock only the network boundary (authApi.me) so RequireAuth's own guard
// logic — the thing AC5 requires — runs for real and is what this test
// actually exercises.
vi.mock('../services/authApi', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
  CSRF_HEADER: 'X-Atlas-CSRF',
}));

import { authApi } from '../services/authApi';

function renderGuarded(initialPath = '/work') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown' });
  vi.mocked(authApi.me).mockReset();
});

describe('RequireAuth (AC5: argon2 login gates protected routes)', () => {
  it('never renders protected content while unauthenticated — redirects to /login instead', async () => {
    vi.mocked(authApi.me).mockResolvedValue(false);

    renderGuarded('/work');

    await waitFor(() => expect(screen.getByText('Login screen')).toBeInTheDocument());
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('renders protected content once the session is confirmed authenticated', async () => {
    vi.mocked(authApi.me).mockResolvedValue(true);

    renderGuarded('/work');

    await waitFor(() => expect(screen.getByText('Protected content')).toBeInTheDocument());
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });

  it('renders neither login nor protected content while the session check is still pending', () => {
    vi.mocked(authApi.me).mockReturnValue(new Promise<boolean>(() => {}));

    renderGuarded('/work');

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  });

  it('checks the session via GET /api/me through authApi, not a locally-invented check', async () => {
    vi.mocked(authApi.me).mockResolvedValue(true);

    renderGuarded('/agent');

    await waitFor(() => expect(authApi.me).toHaveBeenCalledTimes(1));
  });
});
