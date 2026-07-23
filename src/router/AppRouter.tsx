import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../components/login/LoginPage';
import { AuthenticatedShell } from '../components/layout/AuthenticatedShell';
import { RequireAuth } from './RequireAuth';

/**
 * Top-level routing structure (SPEC R4/R5 shell foundation).
 *
 * `/login` is a pre-auth gate OUTSIDE navigation — it is not wrapped by
 * `RequireAuth` and is not one of the six areas. Every other path is
 * protected by `RequireAuth` and handled by `AuthenticatedShell`, which
 * derives the active area (Agent/Work/Clients/Today/Files/Settings) from
 * the URL itself (`src/types/areas.ts`) rather than matching a route per
 * area, so the shell mounts once and does not remount/re-fetch on every
 * area switch.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AuthenticatedShell />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
