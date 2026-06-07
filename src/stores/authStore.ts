// Auth store. The single source of truth for "is the current user signed in?"
// on the frontend.
//
// State machine:
//
//   uninitialised  → fetchStatus()
//                   ↓
//   noUsers        (server has no users → AuthGate shows bootstrap form)
//   needsLogin     (server has users, no session cookie → AuthGate shows
//                    login / invite-signup)
//   checking       (in-flight /api/auth/me check)
//   authenticated  (we have a user)
//   error          (DB unreachable or transient network error)
//
// Stores that need to react to auth state (e.g. a future "clear all local
// caches on logout" hook) can subscribe to `user` via Zustand's selector.

import { create } from 'zustand';
import {
  authRepository,
  type AuthUser,
  type BootstrapInput,
  type CreateInviteInput,
  type InviteResult,
  type LoginInput,
  type RegisterWithInviteInput,
  type StatusResult,
} from '../repositories/authRepository';
import { ApiError } from '../services/apiClient';

export type AuthPhase =
  | 'uninitialised'
  | 'noUsers'
  | 'needsLogin'
  | 'checking'
  | 'authenticated'
  | 'error';

export interface AuthState {
  user: AuthUser | null;
  phase: AuthPhase;
  /** Last error message, surfaced in the auth gate UI. Cleared on success. */
  error: string | null;
  /** True when a bootstrap / login / register is in flight. */
  busy: boolean;
  /** True if the server is reachable but unhealthy. */
  serverReady: boolean;

  /** Run once at app start. Sets `user` + `phase` based on the server state. */
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;

  bootstrap: (input: BootstrapInput) => Promise<AuthUser>;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;

  createInvite: (input?: CreateInviteInput) => Promise<InviteResult>;
  registerWithInvite: (input: RegisterWithInviteInput) => Promise<AuthUser>;

  clearError: () => void;
}

function messageFromError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Cannot reach the server. Check your connection and try again.';
    if (err.status === 503) return 'The server is temporarily unavailable. Try again in a moment.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  phase: 'uninitialised',
  error: null,
  busy: false,
  serverReady: true,

  initialize: async () => {
    if (get().phase === 'checking') return;
    set({ phase: 'checking', error: null, serverReady: true });
    try {
      // `me` requires a valid session cookie. If the user is logged in it
      // returns the user; if not, it 401s and we fall through to the
      // status check below to decide which form to show.
      try {
        const { user } = await authRepository.me();
        set({ user, phase: 'authenticated', error: null, serverReady: true });
        return;
      } catch (err) {
        if (!(err instanceof ApiError) || !err.isUnauthorized) throw err;
      }
      const status: StatusResult = await authRepository.status();
      set({
        user: null,
        phase: status.hasUsers ? 'needsLogin' : 'noUsers',
        error: null,
        serverReady: status.ready !== false,
      });
    } catch (err) {
      set({
        phase: 'error',
        user: null,
        error: messageFromError(err, 'Failed to contact the server.'),
        serverReady: false,
      });
    }
  },

  refresh: async () => {
    if (get().phase === 'checking') return;
    const previousUser = get().user;
    set({ phase: 'checking', error: null });
    try {
      const { user } = await authRepository.me();
      set({ user, phase: 'authenticated', error: null });
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized && previousUser) {
        // Session expired — drop the cached user and bounce to the gate.
        set({ user: null, phase: 'needsLogin', error: 'Your session has expired. Please sign in again.' });
        return;
      }
      set({
        phase: previousUser ? 'authenticated' : 'needsLogin',
        error: messageFromError(err, 'Failed to contact the server.'),
      });
    }
  },

  bootstrap: async (input) => {
    set({ busy: true, error: null });
    try {
      const { user } = await authRepository.bootstrap(input);
      set({ user, phase: 'authenticated', busy: false, error: null });
      return user;
    } catch (err) {
      set({ busy: false, error: messageFromError(err, 'Could not create the first user.') });
      throw err;
    }
  },

  login: async (input) => {
    set({ busy: true, error: null });
    try {
      const { user } = await authRepository.login(input);
      set({ user, phase: 'authenticated', busy: false, error: null });
      return user;
    } catch (err) {
      set({ busy: false, error: messageFromError(err, 'Invalid email or password.') });
      throw err;
    }
  },

  logout: async () => {
    set({ busy: true, error: null });
    try {
      // Always clear local state, even if the server call fails. The cookie
      // may have already expired, and we want the user to land on the gate.
      try {
        await authRepository.logout();
      } catch {
        // ignore — we still want to clear local state
      }
      set({ user: null, phase: 'needsLogin', busy: false, error: null });
    } finally {
      set({ busy: false });
    }
  },

  createInvite: async (input = {}) => {
    set({ busy: true, error: null });
    try {
      const result = await authRepository.createInvite(input);
      set({ busy: false, error: null });
      return result;
    } catch (err) {
      set({ busy: false, error: messageFromError(err, 'Could not create an invite.') });
      throw err;
    }
  },

  registerWithInvite: async (input) => {
    set({ busy: true, error: null });
    try {
      const { user } = await authRepository.registerWithInvite(input);
      set({ user, phase: 'authenticated', busy: false, error: null });
      return user;
    } catch (err) {
      set({ busy: false, error: messageFromError(err, 'Could not register with that invite.') });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
