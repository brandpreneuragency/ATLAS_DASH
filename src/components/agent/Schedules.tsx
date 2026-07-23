import { useEffect, useState } from 'react';
import { useSchedulesStore, type CronJob } from '../../stores/schedulesStore';

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--c-border-1)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--c-background-2)',
};

/** Very loose 5-field cron shape check; the backend (APScheduler
 * `CronTrigger.from_crontab`) is the authority and returns 400 on anything
 * this soft check misses or mis-accepts. */
function looksLikeCron(expr: string): boolean {
  return expr.trim().split(/\s+/).length === 5;
}

function JobForm({ job, onClose }: { job: CronJob | null; onClose: () => void }) {
  const create = useSchedulesStore((s) => s.create);
  const update = useSchedulesStore((s) => s.update);
  const errorMessage = useSchedulesStore((s) => s.errorMessage);
  const [name, setName] = useState(job?.name ?? '');
  const [prompt, setPrompt] = useState(job?.prompt ?? '');
  const [expr, setExpr] = useState(job?.schedule?.expr ?? '*/30 * * * *');
  const [skills, setSkills] = useState((job?.skills ?? []).join(', '));

  const valid = looksLikeCron(expr) && name.trim().length > 0;

  const save = async () => {
    const input = {
      name,
      prompt,
      expr,
      skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
    };
    const ok = job ? await update(job.id, input) : await create(input);
    if (ok) onClose();
  };

  return (
    <div role="dialog" aria-label={job ? 'Edit schedule' : 'New schedule'} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
      <h4 style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>{job ? 'Edit schedule' : 'New schedule'}</h4>
      <label style={{ fontSize: 'var(--fs-xs)' }}>
        Name
        <input aria-label="Schedule name" value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
      </label>
      <label style={{ fontSize: 'var(--fs-xs)' }}>
        Prompt
        <textarea aria-label="Schedule prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} style={{ display: 'block', width: '100%', minHeight: 60, marginTop: 2 }} />
      </label>
      <label style={{ fontSize: 'var(--fs-xs)' }}>
        Cron expression
        <input aria-label="Cron expression" value={expr} onChange={(e) => setExpr(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2, fontFamily: 'var(--font-mono, monospace)' }} />
      </label>
      {!looksLikeCron(expr) && <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>Expected 5 space-separated fields.</p>}
      <label style={{ fontSize: 'var(--fs-xs)' }}>
        Skills (comma-separated)
        <input aria-label="Skills" value={skills} onChange={(e) => setSkills(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
      </label>
      {errorMessage && <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>{errorMessage}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-icon" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-icon" disabled={!valid} onClick={() => void save()}>Save</button>
      </div>
    </div>
  );
}

/**
 * Agent -> Schedules (Control's `Automation.tsx` Hermes cron jobs table,
 * M5d). Hermes cron CRUD + pause/resume/trigger/delete.
 */
export function Schedules() {
  const state = useSchedulesStore((s) => s.state);
  const jobs = useSchedulesStore((s) => s.jobs);
  const errorMessage = useSchedulesStore((s) => s.errorMessage);
  const actingId = useSchedulesStore((s) => s.actingId);
  const refresh = useSchedulesStore((s) => s.refresh);
  const remove = useSchedulesStore((s) => s.remove);
  const act = useSchedulesStore((s) => s.act);

  const [editing, setEditing] = useState<CronJob | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div id="agent-schedules" style={{ height: '100%', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-lg, 18px)', color: 'var(--c-text-1)' }}>Schedules</h2>
        {state === 'loading' && <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Loading…</span>}
        <button type="button" className="btn-icon" style={{ marginLeft: 'auto', fontSize: 'var(--fs-xs)' }} onClick={() => setCreating(true)}>
          New schedule
        </button>
      </div>

      {state === 'error' && (
        <div role="alert" style={{ fontSize: 'var(--fs-sm)', color: '#b91c1c', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>{errorMessage ?? 'Failed to load schedules.'}</span>
          <button type="button" className="btn-icon" onClick={() => void refresh()}>Retry</button>
        </div>
      )}
      {state !== 'error' && errorMessage && !editing && !creating && (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--fs-xs)', color: '#b91c1c' }}>{errorMessage}</p>
      )}

      {(editing || creating) && (
        <JobForm job={editing} onClose={() => { setEditing(null); setCreating(false); }} />
      )}

      {jobs.length === 0 ? (
        <p className="subtle" style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>
          {state === 'loading' ? 'Loading…' : 'No Hermes cron jobs.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--c-border-1)' }}>
              <th style={{ padding: '6px 10px' }}>Name</th>
              <th style={{ padding: '6px 10px' }}>Schedule</th>
              <th style={{ padding: '6px 10px' }}>State</th>
              <th style={{ padding: '6px 10px' }}>Next run</th>
              <th style={{ padding: '6px 10px' }} />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} data-testid={`schedule-row-${job.id}`} style={{ borderBottom: '1px solid var(--c-border-1)' }}>
                <td style={{ padding: '6px 10px' }}>{job.name}</td>
                <td style={{ padding: '6px 10px' }} className="subtle">
                  {job.schedule?.expr ?? '—'}
                </td>
                <td style={{ padding: '6px 10px' }} data-testid={`schedule-state-${job.id}`}>
                  {job.state ?? (job.enabled ? 'scheduled' : 'paused')}
                </td>
                <td style={{ padding: '6px 10px' }} className="subtle">
                  {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'right', display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)' }}
                    disabled={actingId === job.id}
                    onClick={() => void act(job.id, job.enabled ? 'pause' : 'resume')}
                  >
                    {job.enabled ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)' }}
                    disabled={actingId === job.id}
                    onClick={() => void act(job.id, 'trigger')}
                  >
                    Run now
                  </button>
                  <button type="button" className="btn-icon" style={{ fontSize: 'var(--fs-xs)' }} onClick={() => setEditing(job)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    style={{ fontSize: 'var(--fs-xs)' }}
                    onClick={() => {
                      if (window.confirm(`Delete schedule '${job.name}'?`)) void remove(job.id);
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
