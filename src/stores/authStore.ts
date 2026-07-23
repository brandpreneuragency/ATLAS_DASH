import { create } from 'zustand';
import { authApi, type LoginResult } from '../services/authApi';

export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthStore {
  status: AuthStatus;
  /** Resolves the current session against GET /api/me. Safe to call repeatedly. */
  checkSession: () => Promise<void>;
  login: (password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'unknown',

  checkSession: async () => {
    const authenticated = await authApi.me();
    set({ status: authenticated ? 'authenticated' : 'unauthenticated' });
  },

  login: async (password) => {
    const result = await authApi.login(password);
    if (result.ok) set({ status: 'authenticated' });
    return result;
  },

  logout: async () => {
    await authApi.logout();
    set({ status: 'unauthenticated' });
  },
}));
