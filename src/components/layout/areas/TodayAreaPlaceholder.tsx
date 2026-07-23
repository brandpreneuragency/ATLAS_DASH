/**
 * Today area (M2 map: approvals inbox, D-APPROVALS). The route exists and is
 * reachable from the six-area switcher; the approvals presentation itself
 * (`src/components/chatMode/ApprovalsInbox.tsx` wired full-page) is later
 * phase content, not shell foundation.
 */
export function TodayAreaPlaceholder() {
  return (
    <div
      id="today-area-placeholder"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>
        Today
      </h2>
      <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)', maxWidth: 360 }}>
        Approvals inbox for this area is wired in a later phase.
      </p>
    </div>
  );
}
