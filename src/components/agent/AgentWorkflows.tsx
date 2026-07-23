import { useEffect } from 'react';
import { useWorkflowsStore } from '../../stores/workflowsStore';
import { WorkflowEditorPanel } from './WorkflowEditorPanel';

/**
 * Agent -> Workflows (Control's `Automation.tsx` WorkflowsSection, M5d).
 * List + create/delete/enable; opens `WorkflowEditorPanel` for graph
 * editing, versions, dry run, and execution.
 */
export function AgentWorkflows() {
  const state = useWorkflowsStore((s) => s.state);
  const workflows = useWorkflowsStore((s) => s.workflows);
  const errorMessage = useWorkflowsStore((s) => s.errorMessage);
  const selectedWorkflowId = useWorkflowsStore((s) => s.selectedWorkflowId);
  const refresh = useWorkflowsStore((s) => s.refresh);
  const createWorkflow = useWorkflowsStore((s) => s.createWorkflow);
  const deleteWorkflow = useWorkflowsStore((s) => s.deleteWorkflow);
  const toggleEnabled = useWorkflowsStore((s) => s.toggleEnabled);
  const openEditor = useWorkflowsStore((s) => s.openEditor);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (selectedWorkflowId !== null) {
    return <WorkflowEditorPanel />;
  }

  return (
    <div id="agent-workflows" style={{ height: '100%', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>Workflows</h2>
        {state === 'loading' && (
          <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
            Loading…
          </span>
        )}
        <button type="button" className="btn-icon" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }} onClick={() => void createWorkflow()}>
          New workflow
        </button>
      </div>

      {state === 'error' && (
        <div role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>{errorMessage ?? 'Failed to load workflows.'}</span>
          <button type="button" className="btn-icon" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {state !== 'error' && errorMessage && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>
          {errorMessage}
        </p>
      )}

      {workflows.length === 0 ? (
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
          {state === 'loading' ? 'Loading…' : 'No workflows yet — create one to get started.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border-1)' }}>
              <th style={{ padding: '6px 10px' }}>Name</th>
              <th style={{ padding: '6px 10px' }}>Enabled</th>
              <th style={{ padding: '6px 10px' }}>Version</th>
              <th style={{ padding: '6px 10px' }}>Budget/run</th>
              <th style={{ padding: '6px 10px' }} />
            </tr>
          </thead>
          <tbody>
            {workflows.map((wf) => (
              <tr key={wf.id} data-testid={`workflow-row-${wf.id}`} style={{ borderBottom: '1px solid var(--c-border-1)' }}>
                <td style={{ padding: '6px 10px' }}>
                  <button
                    type="button"
                    onClick={() => openEditor(wf.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--c-accent-center-panel, #0ea5e9)', cursor: 'pointer', padding: 0, font: 'inherit' }}
                  >
                    {wf.name}
                  </button>
                </td>
                <td style={{ padding: '6px 10px' }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={wf.enabled}
                    aria-label={`Toggle ${wf.name}`}
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)' }}
                    onClick={() => void toggleEnabled(wf)}
                  >
                    {wf.enabled ? 'On' : 'Off'}
                  </button>
                </td>
                <td style={{ padding: '6px 10px' }} className="subtle">
                  v{wf.version}
                </td>
                <td style={{ padding: '6px 10px' }} className="subtle">
                  {wf.budget_usd_per_run != null ? `$${wf.budget_usd_per_run.toFixed(2)}` : '—'}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)' }}
                    onClick={() => {
                      if (window.confirm(`Delete workflow '${wf.name}'?`)) void deleteWorkflow(wf.id);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
