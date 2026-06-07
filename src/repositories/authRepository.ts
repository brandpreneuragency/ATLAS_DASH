// Auth repository. The only module (other than the API client) that knows the
// shape and URLs of the auth endpoints.
//
// Stores call these methods. React components call stores. Components do not
// import this file.
//
// Endpoints (see plan.md § "Auth Requirements" and server/src/routes/auth.ts):
//
//   GET    /api/auth/status                → { hasUsers } | 503 (DB down)
//   POST   /api/auth/bootstrap             → first-user only
//   POST   /api/auth/login                 → sets session cookie
//   POST   /api/auth/logout                → auth required
//   GET    /api/auth/me                    → auth required
//   POST   /api/auth/invites               → auth required
//   POST   /api/auth/register-with-invite  → public, invite code required

import { apiClient } from '../services/apiClient';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface StatusResult {
  /** True if at least one user exists on the server. */
  hasUsers: boolean;
  /** False when the database is unreachable. The auth gate should show a
   *  connection error in this state and let the user retry. */
  ready?: boolean;
}

export interface BootstrapInput {
  email: string;
  displayName: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterWithInviteInput {
  inviteCode: string;
  email: string;
  displayName: string;
  password: string;
}

export interface CreateInviteInput {
  expiresInDays?: number;
}

export interface InviteResult {
  /** Raw invite code, returned ONCE. The server only stores its hash. */
  code: string;
  /** Unix-ms expiry timestamp (server-generated). */
  expiresAt: number;
}

export const authRepository = {
  status(signal?: AbortSignal): Promise<StatusResult> {
    return apiClient.get<StatusResult>('/auth/status', { signal });
  },

  bootstrap(input: BootstrapInput): Promise<{ user: AuthUser }> {
    return apiClient.post<{ user: AuthUser }>('/auth/bootstrap', input);
  },

  login(input: LoginInput): Promise<{ user: AuthUser }> {
    return apiClient.post<{ user: AuthUser }>('/auth/login', input);
  },

  logout(): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>('/auth/logout');
  },

  me(signal?: AbortSignal): Promise<{ user: AuthUser }> {
    return apiClient.get<{ user: AuthUser }>('/auth/me', { signal });
  },

  createInvite(input: CreateInviteInput = {}): Promise<InviteResult> {
    return apiClient.post<InviteResult>('/auth/invites', input);
  },

  registerWithInvite(input: RegisterWithInviteInput): Promise<{ user: AuthUser }> {
    return apiClient.post<{ user: AuthUser }>('/auth/register-with-invite', input);
  },
};
