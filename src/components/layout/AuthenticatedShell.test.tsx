import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthenticatedShell } from './AuthenticatedShell';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useTaskStore } from '../../stores/taskStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore, type CRMPage, type FormsPage } from '../../stores/uiStore';
import { useAIStore } from '../../stores/aiStore';
import { useThemeStore } from '../../stores/themeStore';
import { useCrmStore } from '../../stores/crmStore';
import { useFormsStore } from '../../stores/formsStore';
import { AREAS } from '../../types/areas';

// This suite renders the REAL AuthenticatedShell plus the REAL CRM/Forms/
// Documents/Tasks screens (no stubbed components) to prove the six-area
// shell actually mounts them, not just that a placeholder route exists.
//
// CRM, Forms, Documents (workspaceStore) and Tasks (taskStore/projectStore)
// are all "local-first using Dexie" (see each store's own file banner) —
// there is no Python backend for any of them in V1 (see SCREEN_PARITY.md).
// jsdom has no IndexedDB and this repo has no `fake-indexeddb` dependency,
// so real Dexie table access throws/rejects here. `dbStub` stands in for
// that one persistence boundary only (Dexie tables resolve to empty
// defaults); every store's own logic, every page component, and
// AuthenticatedShell's own area-routing switch run completely unmodified.
//
// The stub is necessarily untyped (it has to answer to Dexie's own dynamic
// Table/Collection API, which this test never imports), hence the isolated
// eslint-disables below rather than sprinkling `unknown` casts through it.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
const { dbStub } = vi.hoisted(() => {
  function chainable(resolveValue: unknown = []): any {
    const promise = Promise.resolve(resolveValue);
    return new Proxy(promise, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        return (..._args: unknown[]) => chainable(resolveValue);
      },
    });
  }
  function tableStub(): any {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          switch (prop) {
            case 'get':
              return async () => undefined;
            case 'toArray':
              return async () => [];
            case 'count':
              return async () => 0;
            case 'put':
            case 'add':
            case 'bulkPut':
            case 'bulkAdd':
            case 'update':
            case 'delete':
            case 'bulkDelete':
            case 'clear':
              return async () => undefined;
            default:
              // where/orderBy/filter/reverse/limit/offset/equals/above/below/
              // between/anyOf/startsWith/sortBy/first/last/each/... — keep
              // chaining; the chain eventually resolves to `[]`.
              return (..._args: unknown[]) => chainable([]);
          }
        },
      },
    );
  }
  function makeDbStub(): any {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'open' || prop === 'transaction') return async () => undefined;
          return tableStub();
        },
      },
    );
  }
  return { dbStub: makeDbStub() };
});
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

vi.mock('../../services/db', () => ({
  db: dbStub,
  getSetting: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
  setSetting: vi.fn(async () => undefined),
}));

vi.mock('../../data/crmFormsDb', () => ({
  crmFormsDb: dbStub,
  getCrmSetting: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
  setCrmSetting: vi.fn(async () => undefined),
  isCrmDataEmpty: vi.fn(async () => false),
  isFormsDataEmpty: vi.fn(async () => false),
}));

// jsdom does not implement ResizeObserver; the pre-existing header TabBar
// (mounted unconditionally, unrelated to this phase) uses one to detect tab
// overflow.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

function primeStartupLoads() {
  useWorkspaceStore.setState({ isLoaded: true, workspaces: [], activeWorkspaceId: null });
  vi.spyOn(useWorkspaceStore.getState(), 'loadWorkspaces').mockResolvedValue(undefined);
  useTaskStore.setState({ isLoaded: true, tasks: [] });
  vi.spyOn(useTaskStore.getState(), 'loadTasks').mockResolvedValue(undefined);
  useProjectStore.setState({ isLoaded: true, projects: [] });
  vi.spyOn(useProjectStore.getState(), 'loadProjects').mockResolvedValue(undefined);
  vi.spyOn(useUIStore.getState(), 'loadUISettings').mockResolvedValue(undefined);
  vi.spyOn(useAIStore.getState(), 'loadAISettings').mockResolvedValue(undefined);
  vi.spyOn(useThemeStore.getState(), 'loadThemeTokens').mockResolvedValue(undefined);
  useCrmStore.setState({ isLoaded: true });
  vi.spyOn(useCrmStore.getState(), 'loadCrm').mockResolvedValue(undefined);
  useFormsStore.setState({ isLoaded: true });
  vi.spyOn(useFormsStore.getState(), 'loadForms').mockResolvedValue(undefined);
}

function renderShellAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthenticatedShell />
    </MemoryRouter>,
  );
}

describe('AuthenticatedShell — Clients and Work area content (D-CRM-HOME, M5g)', () => {
  beforeEach(() => {
    primeStartupLoads();
    useUIStore.setState({
      taskMode: false,
      activeTaskPage: 'list',
      activeCRMPage: 'dashboard' as CRMPage,
      activeFormsPage: 'list' as FormsPage,
    });
  });

  it('the shell exposes exactly the six ratified areas — no seventh', () => {
    expect(AREAS).toEqual(['agent', 'work', 'clients', 'today', 'files', 'settings']);
  });

  it('Clients (/clients) mounts the real CRM workspace, not a placeholder', () => {
    renderShellAt('/clients');

    expect(document.getElementById('crm-workspace')).toBeTruthy();
    expect(screen.getByText('CRM Dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/not yet built|placeholder/i)).not.toBeInTheDocument();
  });

  it("Clients (/clients) hosts Forms as CRM's tenant page, not a seventh area", () => {
    useUIStore.setState({ activeCRMPage: 'forms' as CRMPage, activeFormsPage: 'list' as FormsPage });
    renderShellAt('/clients');

    // Still inside the Clients CRM workspace shell — Forms is a page of it.
    expect(document.getElementById('crm-workspace')).toBeTruthy();
    expect(document.getElementById('forms-workspace')).toBeTruthy();
  });

  it('Work (/work) renders the Documents editor when task mode is off', () => {
    renderShellAt('/work');

    expect(document.getElementById('editor-column')).toBeTruthy();
    expect(document.getElementById('crm-workspace')).toBeFalsy();
  });

  it('Work (/work) renders Tasks (not Documents) when task mode is on', () => {
    useUIStore.setState({ taskMode: true, activeTaskPage: 'projects' });
    renderShellAt('/work');

    expect(document.getElementById('editor-column')).toBeFalsy();
    expect(screen.getByText('No tasks or projects yet')).toBeInTheDocument();
  });
});
