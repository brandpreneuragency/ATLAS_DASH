import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodayApprovals } from './TodayApprovals';
import { useTodayApprovalsStore, type Approval } from '../../stores/todayApprovalsStore';

function queueFetch(responses: Array<{ status: number; body: unknown }>): typeof fetch {
  let i = 0;
  return (async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

const originalFetch = global.fetch;

const approval: Approval = {
  id: 1,
  run_id: 3,
  step_id: null,
  kind: 'gate',
  external_ref: null,
  message: 'Approve deploy?',
  status: 'pending',
  requested_at: new Date().toISOString(),
  resolved_at: null,
  resolved_via: null,
};

describe('TodayApprovals', () => {
  beforeEach(() => {
    useTodayApprovalsStore.setState({
      state: 'loading',
      approvals: [],
      errorMessage: null,
      resolvingIds: [],
      conflictIds: [],
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists pending approvals loaded on mount', async () => {
    global.fetch = queueFetch([{ status: 200, body: [approval] }]);

    render(<TodayApprovals />);

    await waitFor(() => expect(screen.getByTestId('approval-1')).toBeInTheDocument());
    expect(screen.getByTestId('approval-1')).toHaveTextContent('Approve deploy?');
    expect(screen.getByTestId('approval-1')).toHaveTextContent('run #3');
  });

  it('approving successfully removes the card from the list', async () => {
    global.fetch = queueFetch([
      { status: 200, body: [approval] }, // initial GET
      { status: 200, body: { ...approval, status: 'approved' } }, // POST resolve
    ]);
    const user = userEvent.setup();

    render(<TodayApprovals />);
    await waitFor(() => expect(screen.getByTestId('approval-1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.queryByTestId('approval-1')).not.toBeInTheDocument());
    expect(screen.getByText('No pending approvals.')).toBeInTheDocument();
  });

  it('a 409 on resolve keeps the card, shows the retry hint, and does not raise an error banner', async () => {
    global.fetch = queueFetch([
      { status: 200, body: [approval] }, // initial GET
      { status: 409, body: { detail: 'run not resumable right now' } }, // POST resolve
      { status: 200, body: [approval] }, // refetch — still pending
    ]);
    const user = userEvent.setup();

    render(<TodayApprovals />);
    await waitFor(() => expect(screen.getByTestId('approval-1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.getByTestId('approval-1')).toHaveTextContent('Just missed it'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Still resolvable — button is present and enabled again.
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('a hard error on resolve surfaces the error banner and keeps the card for retry', async () => {
    global.fetch = queueFetch([
      { status: 200, body: [approval] }, // initial GET
      { status: 500, body: { detail: 'boom' } }, // POST resolve
    ]);
    const user = userEvent.setup();

    render(<TodayApprovals />);
    await waitFor(() => expect(screen.getByTestId('approval-1')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByTestId('approval-1')).toBeInTheDocument();
  });
});
