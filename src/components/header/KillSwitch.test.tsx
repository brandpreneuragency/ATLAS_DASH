import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KillSwitch } from './KillSwitch';
import { useKillSwitchStore } from '../../stores/killSwitchStore';

// ---------------------------------------------------------------------------
// Helpers — a queued fetch stub that records every call, mirroring the
// pattern in src/services/ai/importProviderModels.test.ts.
// ---------------------------------------------------------------------------

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function queueFetch(responses: Array<{ status: number; body: unknown }>): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let i = 0;
  const fn: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;

describe('KillSwitch', () => {
  beforeEach(() => {
    useKillSwitchStore.setState({ status: 'loading', busy: false });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads the current paused state from GET /api/killswitch on mount', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: { paused: false } }]);
    global.fetch = fetch;

    render(<KillSwitch />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/killswitch');
    expect(calls[0].init).toMatchObject({ credentials: 'include' });
  });

  it('engaging POSTs paused:true with the CSRF header and reflects the engaged response', async () => {
    const { fetch, calls } = queueFetch([
      { status: 200, body: { paused: false } }, // initial GET
      { status: 200, body: { paused: true } }, // POST engage
    ]);
    global.fetch = fetch;
    const user = userEvent.setup();

    render(<KillSwitch />);
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false'));

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true'));
    expect(calls).toHaveLength(2);
    const post = calls[1];
    expect(post.url).toBe('/api/killswitch');
    expect(post.init?.method).toBe('POST');
    expect(post.init?.credentials).toBe('include');
    const headers = post.init?.headers as Record<string, string>;
    expect(headers['X-Atlas-CSRF']).toBe('1');
    expect(JSON.parse(post.init?.body as string)).toEqual({ paused: true });
  });

  it('releasing POSTs paused:false when already engaged', async () => {
    const { fetch, calls } = queueFetch([
      { status: 200, body: { paused: true } }, // initial GET — already engaged
      { status: 200, body: { paused: false } }, // POST release
    ]);
    global.fetch = fetch;
    const user = userEvent.setup();

    render(<KillSwitch />);
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true'));

    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false'));
    expect(JSON.parse(calls[1].init?.body as string)).toEqual({ paused: false });
  });

  it('disables the button and surfaces an error state when the system router is unreachable', async () => {
    const { fetch } = queueFetch([{ status: 500, body: { detail: 'boom' } }]);
    global.fetch = fetch;

    render(<KillSwitch />);

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
  });
});
