/**
 * Files area (M2 map: root-jailed VPS file browser, D-FILES). The route
 * exists and is reachable from the six-area switcher; the browser/editor
 * presentation itself is later phase content, not shell foundation.
 */
export function FilesAreaPlaceholder() {
  return (
    <div
      id="files-area-placeholder"
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
        Files
      </h2>
      <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)', maxWidth: 360 }}>
        The VPS file browser for this area is wired in a later phase.
      </p>
    </div>
  );
}
