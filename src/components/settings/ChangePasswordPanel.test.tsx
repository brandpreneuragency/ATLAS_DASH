import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordPanel } from './ChangePasswordPanel';

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function mockFetch(reply: { status: number; body?: unknown }): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fn: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: reply.body === undefined ? undefined : { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

const CURRENT = 'the-current-password';
const NEXT = 'a-brand-new-password';

async function fillAndSubmit(next = NEXT, confirm = next) {
  await userEvent.type(screen.getByLabelText(/current password/i), CURRENT);
  await userEvent.type(screen.getByLabelText(/^new password/i), next);
  await userEvent.type(screen.getByLabelText(/confirm new password/i), confirm);
  await userEvent.click(screen.getByRole('button', { name: /change password/i }));
}

describe('ChangePasswordPanel (F10)', () => {
  it('posts both passwords to /api/auth/password with the CSRF header and the session cookie', async () => {
    const { fetch, calls } = mockFetch({ status: 204 });
    global.fetch = fetch;
    render(<ChangePasswordPanel />);

    await fillAndSubmit();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe('/api/auth/password');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      current_password: CURRENT,
      new_password: NEXT,
    });
    expect((calls[0].init?.headers as Record<string, string>)['X-Atlas-CSRF']).toBe('1');
    expect(calls[0].init?.credentials).toBe('include');
  });

  it('confirms success and clears every field so no password is left sitting in the DOM', async () => {
    global.fetch = mockFetch({ status: 204 }).fetch;
    render(<ChangePasswordPanel />);

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/changed/i));
    for (const label of [/current password/i, /^new password/i, /confirm new password/i]) {
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
    expect(document.body.innerHTML).not.toContain(CURRENT);
    expect(document.body.innerHTML).not.toContain(NEXT);
  });

  it('tells the user their current password was wrong on a 401', async () => {
    global.fetch = mockFetch({ status: 401, body: { detail: 'Current password is incorrect' } }).fetch;
    render(<ChangePasswordPanel />);

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/current password is incorrect/i),
    );
  });

  it('surfaces the backend rejection message verbatim on a 400', async () => {
    global.fetch = mockFetch({
      status: 400,
      body: { detail: 'New password must be at least 12 characters.' },
    }).fetch;
    render(<ChangePasswordPanel />);

    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/at least 12 characters/i),
    );
  });

  it('does not call the API at all when the confirmation does not match', async () => {
    const { fetch, calls } = mockFetch({ status: 204 });
    global.fetch = fetch;
    render(<ChangePasswordPanel />);

    await fillAndSubmit(NEXT, 'something-else-entirely');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i));
    expect(calls).toHaveLength(0);
  });

  it('warns that other sessions will be signed out, because that is a surprising side effect', () => {
    render(<ChangePasswordPanel />);
    expect(
      screen.getByText(/sign\w* out every other browser and device/i),
    ).toBeInTheDocument();
  });
});
