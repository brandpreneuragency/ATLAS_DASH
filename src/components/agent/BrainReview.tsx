import { useEffect, useRef } from 'react';
import { useReviewStore, type ReviewItem } from '../../stores/reviewStore';

/**
 * Agent -> Brain Review (Control's `Review.tsx`, M5). Lists notes pending a
 * decision; Approve/Reject dispatch the guarded Hermes brain workflow via
 * `server/app/routers/review.py::decide_review` — this component never
 * resolves anything itself, it only asks the backend to run that workflow.
 * While a decision is in flight for a note, this polls `refresh()` every 3s
 * (matching Control's `Review.tsx`) so the busy indicator clears as soon as
 * the note leaves the pending queue.
 */
export function BrainReview() {
  const state = useReviewStore((s) => s.state);
  const items = useReviewStore((s) => s.items);
  const errorMessage = useReviewStore((s) => s.errorMessage);
  const processing = useReviewStore((s) => s.processing);
  const refresh = useReviewStore((s) => s.refresh);
  const decide = useReviewStore((s) => s.decide);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (Object.keys(processing).length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (!pollRef.current) {
      pollRef.current = setInterval(() => void refresh(), 3_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [processing, refresh]);

  return (
    <div
      id="brain-review"
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>
          Brain Review
        </h2>
        {state === 'loading' && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Loading…
          </span>
        )}
      </div>
      <p className="subtle" style={{ fontSize: 'var(--fs-xs)', margin: 0 }}>
        Brain review notes pending a decision — approve dispatches the guarded Hermes brain workflow.
      </p>

      {errorMessage && (
        <div
          role="alert"
          style={{
            border: '1px solid #b91c1c',
            borderRadius: 8,
            padding: 10,
            color: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 'var(--fs-sm)',
          }}
        >
          <span>{errorMessage}</span>
          <button type="button" className="btn-icon" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      {state === 'ready' && items.length === 0 && (
        <p className="subtle" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>
          Nothing waiting for review.
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => {
          const busy = item.name in processing;
          return <ReviewRow key={item.name} item={item} busy={busy} onDecide={decide} />;
        })}
      </ul>
    </div>
  );
}

function ReviewRow({
  item,
  busy,
  onDecide,
}: {
  item: ReviewItem;
  busy: boolean;
  onDecide: (name: string, decision: 'approved' | 'rejected') => void;
}) {
  return (
    <li
      data-testid={`review-${item.name}`}
      style={{
        border: '1px solid var(--c-border-1)',
        borderRadius: 8,
        padding: 12,
        background: 'var(--c-background-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{item.name}</span>
        {Object.keys(item.frontmatter).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(item.frontmatter).map(([key, value]) => (
              <span
                key={key}
                className="subtle"
                style={{
                  fontSize: 'var(--fs-xs)',
                  border: '1px solid var(--c-border-1)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                {key}: {String(value)}
              </span>
            ))}
          </div>
        )}
        <p className="subtle" style={{ fontSize: 'var(--fs-xs)', margin: 0, whiteSpace: 'pre-wrap' }}>
          {item.body_preview}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {busy ? (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Hermes working…
          </span>
        ) : (
          <>
            <button
              type="button"
              className="btn-icon"
              style={{
                fontSize: 'var(--fs-xs)',
                padding: '4px 10px',
                border: '1px solid var(--c-border-1)',
                borderRadius: 6,
              }}
              onClick={() => onDecide(item.name, 'rejected')}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-icon"
              style={{
                fontSize: 'var(--fs-xs)',
                padding: '4px 10px',
                borderRadius: 6,
                background: 'var(--c-accent-center-panel)',
                color: '#fff',
              }}
              onClick={() => onDecide(item.name, 'approved')}
            >
              Approve
            </button>
          </>
        )}
      </div>
    </li>
  );
}
