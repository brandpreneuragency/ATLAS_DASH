import { create } from 'zustand';
import { CSRF_HEADER } from '../services/authApi';

/**
 * Agent → Workflows + Workflow Editor (Control's `Automation.tsx`
 * WorkflowsSection + `WorkflowEditor.tsx`), wired to
 * `server/app/routers/workflows.py`:
 *  - GET    /api/workflows
 *  - POST   /api/workflows
 *  - PUT    /api/workflows/{id}                (validates the graph; 422 on failure)
 *  - DELETE /api/workflows/{id}
 *  - POST   /api/workflows/{id}/enable
 *  - GET    /api/workflows/{id}/versions
 *  - POST   /api/workflows/{id}/rollback
 *  - POST   /api/workflows/{id}/run             ({ dry_run, payload })
 *
 * Scope note (SCREEN_PARITY.md): Control's `WorkflowEditor.tsx` is a
 * drag/drop `@xyflow/react` node canvas (`NodePalette`/`Canvas`/
 * `ConfigPanel`/live SSE run-state overlay). That dependency does not exist
 * in DASH and porting a full graph canvas is out of this phase's budget.
 * This editor preserves the *functional* capabilities the SPEC lists —
 * graph editing, validation, versions, enablement, dry run, execution —
 * via a structured JSON graph editor instead of the visual canvas.
 */

export interface WorkflowGraph {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

export interface Workflow {
  id: number;
  name: string;
  description: string;
  graph: WorkflowGraph;
  enabled: boolean;
  version: number;
  max_runs_per_hour: number | null;
  budget_usd_per_run: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowVersion {
  id: number;
  workflow_id: number;
  version: number;
  created_at: string;
}

export type WorkflowsState = 'loading' | 'ready' | 'error';

interface EditorDraft {
  name: string;
  description: string;
  graphText: string;
}

interface WorkflowsStore {
  state: WorkflowsState;
  workflows: Workflow[];
  errorMessage: string | null;

  selectedWorkflowId: number | null;
  editorDraft: EditorDraft | null;
  editorError: string | null;
  editorDirty: boolean;
  versions: WorkflowVersion[];
  lastRunId: number | null;

  refresh: () => Promise<void>;
  createWorkflow: () => Promise<void>;
  deleteWorkflow: (id: number) => Promise<void>;
  toggleEnabled: (workflow: Workflow) => Promise<void>;
  openEditor: (id: number) => void;
  closeEditor: () => void;
  updateDraft: (patch: Partial<EditorDraft>) => void;
  saveDraft: () => Promise<boolean>;
  loadVersions: (id: number) => Promise<void>;
  rollback: (id: number, version: number) => Promise<void>;
  runWorkflow: (id: number, dryRun: boolean) => Promise<void>;
}

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    if (body?.detail) return body.detail;
  } catch {
    // no JSON body — keep the fallback
  }
  return fallback;
}

const NEW_WORKFLOW_GRAPH: WorkflowGraph = {
  nodes: [{ id: 'n1', type: 'trigger.manual', position: { x: 0, y: 0 }, config: {} }],
  edges: [],
};

export const useWorkflowsStore = create<WorkflowsStore>((set, get) => ({
  state: 'loading',
  workflows: [],
  errorMessage: null,

  selectedWorkflowId: null,
  editorDraft: null,
  editorError: null,
  editorDirty: false,
  versions: [],
  lastRunId: null,

  refresh: async () => {
    set({ state: 'loading', errorMessage: null });
    try {
      const res = await fetch('/api/workflows', { credentials: 'include' });
      if (!res.ok) {
        set({ state: 'error', errorMessage: `Failed to load workflows (${res.status}).` });
        return;
      }
      const workflows = (await res.json()) as Workflow[];
      set({ state: 'ready', workflows, errorMessage: null });
    } catch {
      set({ state: 'error', errorMessage: 'Network error loading workflows.' });
    }
  },

  createWorkflow: async () => {
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ name: 'New workflow', description: '', graph: NEW_WORKFLOW_GRAPH }),
      });
      if (!res.ok) {
        set({ errorMessage: await errorDetail(res, `Could not create workflow (${res.status}).`) });
        return;
      }
      const created = (await res.json()) as Workflow;
      await get().refresh();
      get().openEditor(created.id);
    } catch {
      set({ errorMessage: 'Network error creating workflow.' });
    }
  },

  deleteWorkflow: async (id) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { [CSRF_HEADER]: '1' },
      });
      if (!res.ok && res.status !== 204) {
        set({ errorMessage: `Could not delete workflow #${id} (${res.status}).` });
      }
    } catch {
      set({ errorMessage: `Network error deleting workflow #${id}.` });
    } finally {
      if (get().selectedWorkflowId === id) get().closeEditor();
      await get().refresh();
    }
  },

  toggleEnabled: async (workflow) => {
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/enable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ enabled: !workflow.enabled }),
      });
      if (!res.ok) {
        set({ errorMessage: `Could not toggle workflow #${workflow.id} (${res.status}).` });
      }
    } catch {
      set({ errorMessage: `Network error toggling workflow #${workflow.id}.` });
    } finally {
      await get().refresh();
    }
  },

  openEditor: (id) => {
    const wf = get().workflows.find((w) => w.id === id);
    set({
      selectedWorkflowId: id,
      editorDraft: wf
        ? { name: wf.name, description: wf.description, graphText: JSON.stringify(wf.graph, null, 2) }
        : { name: '', description: '', graphText: JSON.stringify(NEW_WORKFLOW_GRAPH, null, 2) },
      editorError: null,
      editorDirty: false,
      versions: [],
      lastRunId: null,
    });
    void get().loadVersions(id);
  },

  closeEditor: () => {
    set({
      selectedWorkflowId: null,
      editorDraft: null,
      editorError: null,
      editorDirty: false,
      versions: [],
      lastRunId: null,
    });
  },

  updateDraft: (patch) => {
    set((s) => ({
      editorDraft: s.editorDraft ? { ...s.editorDraft, ...patch } : s.editorDraft,
      editorDirty: true,
    }));
  },

  saveDraft: async () => {
    const { selectedWorkflowId, editorDraft, workflows } = get();
    if (selectedWorkflowId === null || editorDraft === null) return false;
    const current = workflows.find((w) => w.id === selectedWorkflowId);

    let graph: unknown;
    try {
      graph = JSON.parse(editorDraft.graphText);
    } catch {
      set({ editorError: 'Graph is not valid JSON.' });
      return false;
    }

    try {
      const res = await fetch(`/api/workflows/${selectedWorkflowId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({
          name: editorDraft.name,
          description: editorDraft.description,
          graph,
          max_runs_per_hour: current?.max_runs_per_hour ?? null,
          budget_usd_per_run: current?.budget_usd_per_run ?? null,
        }),
      });
      if (!res.ok) {
        // Surfaces the server's 422 validation message verbatim — this is
        // "validation" for the JSON-editor scope: the engine's
        // `validate_graph` is the single source of truth for graph
        // correctness, not a client-side re-implementation of it.
        set({ editorError: await errorDetail(res, `Save failed (${res.status}).`) });
        return false;
      }
      const saved = (await res.json()) as Workflow;
      set({ editorError: null, editorDirty: false });
      await get().refresh();
      await get().loadVersions(saved.id);
      return true;
    } catch {
      set({ editorError: 'Network error saving workflow.' });
      return false;
    }
  },

  loadVersions: async (id) => {
    try {
      const res = await fetch(`/api/workflows/${id}/versions`, { credentials: 'include' });
      if (!res.ok) return;
      const versions = (await res.json()) as WorkflowVersion[];
      set({ versions });
    } catch {
      // best effort — versions drawer just stays empty
    }
  },

  rollback: async (id, version) => {
    try {
      const res = await fetch(`/api/workflows/${id}/rollback`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) {
        set({ editorError: await errorDetail(res, `Rollback failed (${res.status}).`) });
        return;
      }
      const rolled = (await res.json()) as Workflow;
      set({
        editorDraft: {
          name: rolled.name,
          description: rolled.description,
          graphText: JSON.stringify(rolled.graph, null, 2),
        },
        editorDirty: false,
        editorError: null,
      });
      await get().refresh();
      await get().loadVersions(id);
    } catch {
      set({ editorError: 'Network error rolling back workflow.' });
    }
  },

  runWorkflow: async (id, dryRun) => {
    try {
      const res = await fetch(`/api/workflows/${id}/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', [CSRF_HEADER]: '1' },
        body: JSON.stringify({ dry_run: dryRun, payload: {} }),
      });
      if (!res.ok) {
        set({ editorError: await errorDetail(res, `Run failed (${res.status}).`) });
        return;
      }
      const result = (await res.json()) as { run_id: number };
      set({ lastRunId: result.run_id, editorError: null });
    } catch {
      set({ editorError: 'Network error starting run.' });
    }
  },
}));
