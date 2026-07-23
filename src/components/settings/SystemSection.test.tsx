import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemSection } from './SystemSection';
import { useSettingsSystemStore } from '../../stores/settingsSystemStore';

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function queueFetch(byUrl: (url: string) => { status: number; body?: unknown }): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fn: typeof fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, init });
    const r = byUrl(u);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: r.body === undefined ? undefined : { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;

function resetStore() {
  useSettingsSystemStore.setState({
    state: 'loading',
    errorMessage: null,
    busy: false,
    modelInfo: null,
    env: {},
    prefs: { favorites: [], hidden: [] },
    notify: null,
    limits: null,
    backup: null,
    health: null,
  });
}

// A poison-pill secret string. The real backend NEVER sends this shape (env
// entries only ever carry `is_set`/`redacted_value`/`is_password`/
// `category` — see `server/app/routers/hermes.py::env_list`'s docstring:
// "values arrive pre-masked from Hermes; we never unmask"). We put it in
// the mocked response anyway to prove the component itself never surfaces
// *any* field but the already-redacted display value, even if a future
// backend response accidentally carried something else under an
// unexpected key.
const POISON_SECRET = 'sk-live-THIS-MUST-NEVER-RENDER-abcdef123456';

const routes: Record<string, { status: number; body?: unknown }> = {
  '/api/hermes/model': { status: 200, body: { current: { model: 'gpt-5', provider: 'openai' }, options: { providers: {} } } },
  '/api/hermes/env': {
    status: 200,
    body: {
      OPENAI_API_KEY: {
        is_set: true,
        redacted_value: 'sk-***abcd',
        is_password: true,
        category: 'llm',
        raw_value: POISON_SECRET, // poison field — must never be rendered
      },
    },
  },
  '/api/settings/model-prefs': { status: 200, body: { favorites: [], hidden: [] } },
  '/api/settings/notifications': {
    status: 200,
    body: { telegram_bot_token_set: true, telegram_chat_id: '12345', smtp_url_set: true, smtp_to: 'ops@example.com' },
  },
  '/api/settings/limits': { status: 200, body: { default_max_runs_per_hour: 6, default_budget_usd_per_run: null, global_concurrency: 2 } },
  '/api/settings/backup': { status: 200, body: { ok: true, ts: '2026-07-23T00:00:00Z', size: 2048 } },
  '/api/health': { status: 200, body: { status: 'ok', db: 'ok', hermes: { runs_api: 'ok' }, version: '0.1.0' } },
};

function mockAll() {
  return queueFetch((url) => routes[url] ?? { status: 404, body: { detail: 'not mocked' } });
}

describe('SystemSection (Settings -> System, D-MODELS) — secrets masking', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders only the backend-redacted value for a provider key, never a raw/unmasked value even if present in the payload', async () => {
    global.fetch = mockAll().fetch;

    render(<SystemSection />);
    // Provider keys is not the default sub-tab; switch to it.
    await userEvent.click(await screen.findByText('Provider keys'));

    expect(await screen.findByTestId('env-masked-OPENAI_API_KEY')).toHaveTextContent('sk-***abcd');
    expect(screen.queryByText(POISON_SECRET, { exact: false })).not.toBeInTheDocument();
    // Also assert against the raw document body, not just the react-tree
    // text query, so this fails if the secret leaks into an attribute
    // (title, value, aria-label, etc.) rather than as text content.
    expect(document.body.innerHTML).not.toContain(POISON_SECRET);
  });

  it('the Telegram bot token field starts blank even though telegram_bot_token_set is true, and Save omits it when untouched', async () => {
    const { fetch, calls } = mockAll();
    global.fetch = fetch;

    render(<SystemSection />);
    await userEvent.click(await screen.findByText('Notifications'));

    const tokenInput = await screen.findByLabelText('telegram bot token');
    expect(tokenInput).toHaveAttribute('type', 'password');
    expect(tokenInput).toHaveValue('');

    // Edit only the plain (non-secret) chat id field, then save.
    const chatIdInput = screen.getByDisplayValue('12345');
    await userEvent.clear(chatIdInput);
    await userEvent.type(chatIdInput, '67890');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      const putCall = calls.find((c) => c.url === '/api/settings/notifications' && c.init?.method === 'PUT');
      expect(putCall).toBeDefined();
      const body = JSON.parse(String(putCall?.init?.body));
      // Plain (non-secret) fields are always resent verbatim; only the two
      // secret fields (token / smtp url) must be omitted when untouched.
      expect(body).toEqual({ telegram_chat_id: '67890', smtp_to: 'ops@example.com' });
      // Never resend a placeholder for the token/smtp secrets just because
      // `*_set` was true.
      expect(body.telegram_bot_token).toBeUndefined();
      expect(body.smtp_url).toBeUndefined();
    });
  });
});
