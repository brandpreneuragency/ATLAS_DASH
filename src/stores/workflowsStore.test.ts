import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useWorkflowsStore, type Workflow } from './workflowsStore';

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

const workflow: Workflow = {
  id: 1,
  name: 'Daily digest',
  description: 'sends a digest',
  graph: { nodes: [{ id: 'n1', type: 'trigger.manual' }], edges: [] },
  enabled: false,
  version: 1,
  max_runs_per_hour: 10,
  budget_usd_per_run: 1.5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function resetStore() {
  useWorkflowsStore.setState({
    state: 'loading',
    workflows: [],
    errorMessage: null,
    selectedWorkflowId: null,
    editorDraft: null,
    editorError: null,
    editorDirty: false,
    versions: [],
    lastRunId: null,
  });
}

describe('workflowsStore', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('refresh() loads workflows from GET /api/workflows', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: [workflow] }]);
    global.fetch = fetch;

    await useWorkflowsStore.getState().refresh();

    expect(useWorkflowsStore.getState().state).toBe('ready');
    expect(useWorkflowsStore.getState().workflows).toEqual([workflow]);
    expect(calls[0].url).toBe('/api/workflows');
  });

  it('openEditor() seeds the draft from the workflow graph as pretty JSON', () => {
    useWorkflowsStore.setState({ workflows: [workflow] });

    useWorkflowsStore.getState().openEditor(1);

    const draft = useWorkflowsStore.getState().editorDraft;
    expect(draft?.name).toBe('Daily digest');
    expect(JSON.parse(draft?.graphText ?? '')).toEqual(workflow.graph);
    expect(useWorkflowsStore.getState().editorDirty).toBe(false);
  });

  it('saveDraft() rejects invalid JSON client-side without calling the network', async () => {
    useWorkflowsStore.setState({
      workflows: [workflow],
      selectedWorkflowId: 1,
      editorDraft: { name: 'Daily digest', description: '', graphText: '{ not json' },
    });
    let called = false;
    global.fetch = (async () => {
      called = true;
      throw new Error('should not be called');
    }) as typeof fetch;

    const ok = await useWorkflowsStore.getState().saveDraft();

    expect(ok).toBe(false);
    expect(called).toBe(false);
    expect(useWorkflowsStore.getState().editorError).toBe('Graph is not valid JSON.');
  });

  // --- Validation preservation: the SPEC requires the editor to preserve
  // "validation" from the engine's graph validator. Proven by asserting the
  // server's 422 `detail` message is surfaced verbatim, not swallowed or
  // replaced by a generic string.
  it('saveDraft() surfaces the engine\'s 422 validation detail verbatim on a malformed graph', async () => {
    useWorkflowsStore.setState({
      workflows: [workflow],
      selectedWorkflowId: 1,
      editorDraft: { name: 'Daily digest', description: '', graphText: '{"nodes": [], "edges": []}' },
    });
    const { fetch } = queueFetch([
      { status: 422, body: { detail: 'malformed graph: at least one trigger node required' } },
    ]);
    global.fetch = fetch;

    const ok = await useWorkflowsStore.getState().saveDraft();

    expect(ok).toBe(false);
    expect(useWorkflowsStore.getState().editorError).toBe(
      'malformed graph: at least one trigger node required',
    );
  });

  it('saveDraft() on success clears dirty state and reloads workflows + versions', async () => {
    useWorkflowsStore.setState({
      workflows: [workflow],
      selectedWorkflowId: 1,
      editorDraft: { name: 'Daily digest v2', description: '', graphText: '{"nodes": [], "edges": []}' },
      editorDirty: true,
    });
    const saved = { ...workflow, name: 'Daily digest v2', version: 2 };
    const { fetch, calls } = queueFetch([
      { status: 200, body: saved }, // PUT
      { status: 200, body: [saved] }, // refresh GET
      { status: 200, body: [{ id: 1, workflow_id: 1, version: 2, created_at: new Date().toISOString() }] }, // versions
    ]);
    global.fetch = fetch;

    const ok = await useWorkflowsStore.getState().saveDraft();

    expect(ok).toBe(true);
    expect(useWorkflowsStore.getState().editorDirty).toBe(false);
    expect(useWorkflowsStore.getState().editorError).toBeNull();
    expect(calls[0].url).toBe('/api/workflows/1');
    expect(calls[0].init?.method).toBe('PUT');
  });

  it('rollback() posts { version } and reseeds the draft from the rolled-back graph', async () => {
    useWorkflowsStore.setState({ selectedWorkflowId: 1 });
    const rolled = { ...workflow, version: 3, graph: { nodes: [], edges: [] } };
    const { fetch, calls } = queueFetch([
      { status: 200, body: rolled }, // rollback POST
      { status: 200, body: [rolled] }, // refresh
      { status: 200, body: [] }, // versions
    ]);
    global.fetch = fetch;

    await useWorkflowsStore.getState().rollback(1, 1);

    expect(calls[0].url).toBe('/api/workflows/1/rollback');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ version: 1 });
    expect(useWorkflowsStore.getState().editorDraft?.graphText).toBe(
      JSON.stringify(rolled.graph, null, 2),
    );
  });

  it('runWorkflow(dryRun) posts dry_run correctly and records the returned run_id', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: { run_id: 77 } }]);
    global.fetch = fetch;

    await useWorkflowsStore.getState().runWorkflow(1, true);

    expect(calls[0].url).toBe('/api/workflows/1/run');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ dry_run: true, payload: {} });
    expect(useWorkflowsStore.getState().lastRunId).toBe(77);
  });

  it('toggleEnabled() posts the inverted enabled flag', async () => {
    const { fetch, calls } = queueFetch([
      { status: 200, body: { ...workflow, enabled: true } },
      { status: 200, body: [{ ...workflow, enabled: true }] },
    ]);
    global.fetch = fetch;

    await useWorkflowsStore.getState().toggleEnabled(workflow);

    expect(calls[0].url).toBe('/api/workflows/1/enable');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ enabled: true });
  });
});
