import { useState } from 'react';
import { useWorkflowsStore } from '../../stores/workflowsStore';

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--c-border-1)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--c-background-2)',
};

/**
 * Workflow Editor (Control's `WorkflowEditor.tsx` -> Agent -> Workflows,
 * M5d). Preserves graph editing, validation, versions, enablement, dry run,
 * and execution — see the scope note in `workflowsStore.ts` for why this is
 * a structured JSON editor rather than a ported `@xyflow/react` canvas.
 */
export function WorkflowEditorPanel() {
  const selectedWorkflowId = useWorkflowsStore((s) => s.selectedWorkflowId);
  const draft = useWorkflowsStore((s) => s.editorDraft);
  const editorError = useWorkflowsStore((s) => s.editorError);
  const editorDirty = useWorkflowsStore((s) => s.editorDirty);
  const versions = useWorkflowsStore((s) => s.versions);
  const lastRunId = useWorkflowsStore((s) => s.lastRunId);
  const workflows = useWorkflowsStore((s) => s.workflows);
  const updateDraft = useWorkflowsStore((s) => s.updateDraft);
  const saveDraft = useWorkflowsStore((s) => s.saveDraft);
  const closeEditor = useWorkflowsStore((s) => s.closeEditor);
  const rollback = useWorkflowsStore((s) => s.rollback);
  const runWorkflow = useWorkflowsStore((s) => s.runWorkflow);
  const toggleEnabled = useWorkflowsStore((s) => s.toggleEnabled);

  const [showVersions, setShowVersions] = useState(false);

  if (selectedWorkflowId === null || draft === null) return null;

  const current = workflows.find((w) => w.id === selectedWorkflowId);

  return (
    <div data-testid="workflow-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          type="button"
          className="btn-icon"
          onClick={() => {
            if (editorDirty && !window.confirm('Discard unsaved changes?')) return;
            closeEditor();
          }}
        >
          ← Back
        </button>
        <input
          aria-label="Workflow name"
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          style={{ fontSize: 'var(--fs-md, 15px)', fontWeight: 600, padding: '4px 8px' }}
        />
        {current && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>v{current.version}</span>}
        {editorDirty && (
          <span data-testid="dirty-indicator" style={{ fontSize: 'var(--fs-xs)', color: '#b45309' }}>
            unsaved changes
          </span>
        )}
        {current && (
          <button
            type="button"
            role="switch"
            aria-checked={current.enabled}
            aria-label={`Toggle ${current.name}`}
            className="btn-icon"
            style={{ fontSize: 'var(--fs-xs)' }}
            onClick={() => void toggleEnabled(current)}
          >
            {current.enabled ? 'Enabled' : 'Disabled'}
          </button>
        )}
        <button type="button" className="btn-icon" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }} onClick={() => setShowVersions((v) => !v)}>
          Versions
        </button>
        <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => void runWorkflow(selectedWorkflowId, true)}>
          Dry run
        </button>
        <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => void runWorkflow(selectedWorkflowId, false)}>
          Execute
        </button>
        <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }} onClick={() => void saveDraft()}>
          Save
        </button>
      </div>

      {editorError && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-sm)', color: '#b91c1c' }}>
          {editorError}
        </p>
      )}
      {lastRunId !== null && (
        <p style={{ margin: 0, fontSize: 'var(--fs-xs)' }} data-testid="last-run-id">
          Started run #{lastRunId} — see Agent → Runs.
        </p>
      )}

      <label style={{ fontSize: 'var(--fs-xs)' }}>
        Description
        <textarea
          aria-label="Workflow description"
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          style={{ width: '100%', minHeight: 40, fontSize: 'var(--fs-sm)', marginTop: 4 }}
        />
      </label>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        <label style={{ flex: showVersions ? '1 1 70%' : '1 1 100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <span style={{ fontSize: 'var(--fs-xs)' }}>Graph (JSON)</span>
          <textarea
            aria-label="Workflow graph JSON"
            data-testid="graph-json-editor"
            value={draft.graphText}
            onChange={(e) => updateDraft({ graphText: e.target.value })}
            spellCheck={false}
            style={{
              flex: 1,
              minHeight: 0,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 'var(--fs-xs)',
              marginTop: 4,
              resize: 'none',
            }}
          />
        </label>

        {showVersions && (
          <div style={{ ...cardStyle, flex: '0 0 220px', overflowY: 'auto' }} data-testid="versions-drawer">
            <h4 style={{ margin: '0 0 8px', fontSize: 'var(--fs-sm)' }}>Versions</h4>
            {versions.length === 0 ? (
              <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>No prior versions.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {versions.map((v) => (
                  <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-xs)' }}>
                    <span>v{v.version}</span>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ fontSize: 'var(--fs-xs)' }}
                      onClick={() => void rollback(selectedWorkflowId, v.version)}
                    >
                      Rollback
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
