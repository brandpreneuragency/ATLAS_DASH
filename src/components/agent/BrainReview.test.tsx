import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrainReview } from './BrainReview';
import { useReviewStore, type ReviewItem } from '../../stores/reviewStore';

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

const note: ReviewItem = {
  name: '2026-07-23-idea',
  frontmatter: { tag: 'idea' },
  body_preview: 'A note worth reviewing.',
  source_path: '/vault/inbox/2026-07-23-idea.md',
};

describe('BrainReview (Agent -> Brain Review)', () => {
  beforeEach(() => {
    useReviewStore.setState({ state: 'loading', items: [], errorMessage: null, processing: {} });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists pending review notes loaded on mount', async () => {
    global.fetch = queueFetch([{ status: 200, body: [note] }]);

    render(<BrainReview />);

    await waitFor(() => expect(screen.getByTestId(`review-${note.name}`)).toBeInTheDocument());
    expect(screen.getByTestId(`review-${note.name}`)).toHaveTextContent(note.name);
    expect(screen.getByTestId(`review-${note.name}`)).toHaveTextContent('A note worth reviewing.');
  });

  it('approving a note POSTs {decision: "approved"} and, once Hermes resolves it, removes it from the queue', async () => {
    global.fetch = queueFetch([
      { status: 200, body: [note] }, // initial GET
      { status: 200, body: { run_id: 'run-1' } }, // POST decide
      { status: 200, body: [] }, // refresh — Hermes already resolved it
    ]);
    const user = userEvent.setup();

    render(<BrainReview />);
    await waitFor(() => expect(screen.getByTestId(`review-${note.name}`)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.queryByTestId(`review-${note.name}`)).not.toBeInTheDocument());
    expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument();
  });

  it('a hard error on decide surfaces the error banner and keeps the note for retry', async () => {
    global.fetch = queueFetch([
      { status: 200, body: [note] },
      { status: 500, body: { detail: 'boom' } },
    ]);
    const user = userEvent.setup();

    render(<BrainReview />);
    await waitFor(() => expect(screen.getByTestId(`review-${note.name}`)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByTestId(`review-${note.name}`)).toBeInTheDocument();
  });
});
