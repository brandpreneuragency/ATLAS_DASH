import { AppRouter } from './router/AppRouter';

/**
 * Entry point. Routing (login gate + six-area shell) lives in
 * `src/router/AppRouter.tsx`; the authenticated product itself is
 * `src/components/layout/AuthenticatedShell.tsx`.
 */
export default function App() {
  return <AppRouter />;
}
