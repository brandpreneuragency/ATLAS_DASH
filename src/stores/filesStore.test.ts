import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useFilesStore, joinRelPath, type FileEntry } from './filesStore';

interface RecordedCall {
  url: string;
  init?: RequestInit;
}

function queueFetch(responses: Array<{ status: number; body?: unknown }>): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let i = 0;
  const fn: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: r.body === undefined ? undefined : { 'content-type': 'application/json' },
    });
  };
  return { fetch: fn, calls };
}

const originalFetch = global.fetch;

const entries: FileEntry[] = [
  { name: 'notes', is_dir: true, size: 0, mtime: 100 },
  { name: 'todo.md', is_dir: false, size: 42, mtime: 200 },
];

function resetStore() {
  useFilesStore.setState({
    currentDir: '',
    entries: [],
    dirState: 'loading',
    dirError: null,
    selected: new Set(),
    openPath: null,
    openContent: '',
    openMtime: null,
    openState: 'idle',
    openError: null,
    dirty: false,
    conflict: false,
    actionError: null,
    busy: false,
  });
}

describe('filesStore (Files area, D-FILES, server/app/routers/files.py)', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('joinRelPath joins under the current dir the same way the server-returned entry names do', () => {
    expect(joinRelPath('', 'todo.md')).toBe('todo.md');
    expect(joinRelPath('notes', 'todo.md')).toBe('notes/todo.md');
  });

  it('navigate() lists a directory via GET /api/files/tree?path=', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: { entries } }]);
    global.fetch = fetch;

    await useFilesStore.getState().navigate('notes');

    expect(useFilesStore.getState().dirState).toBe('ready');
    expect(useFilesStore.getState().entries).toEqual(entries);
    expect(calls[0].url).toBe('/api/files/tree?path=notes');
    expect(calls[0].init).toMatchObject({ credentials: 'include' });
  });

  it('navigate() surfaces a non-2xx (e.g. a 400 PathViolation) as dirState error, never a crash', async () => {
    const { fetch } = queueFetch([{ status: 400, body: { detail: "illegal path '../etc': parent traversal" } }]);
    global.fetch = fetch;

    await useFilesStore.getState().navigate('../etc');

    expect(useFilesStore.getState().dirState).toBe('error');
    expect(useFilesStore.getState().dirError).toMatch(/parent traversal/);
  });

  it('openFile() reads a file via GET /api/files/read?path= and records its mtime', async () => {
    const { fetch, calls } = queueFetch([{ status: 200, body: { content: 'hello', mtime: 555, truncated: false } }]);
    global.fetch = fetch;

    await useFilesStore.getState().openFile('notes/todo.md');

    const s = useFilesStore.getState();
    expect(s.openState).toBe('ready');
    expect(s.openContent).toBe('hello');
    expect(s.openMtime).toBe(555);
    expect(calls[0].url).toBe('/api/files/read?path=notes%2Ftodo.md');
  });

  // --- mtime-conflict path (PUT /api/files/write -> 409) ------------------
  //
  // This is the behaviour SPEC explicitly calls out for a fail-provable
  // test: `save()` must (a) send the previously-read mtime as
  // `expected_mtime`, (b) turn a 409 into `conflict: true` without
  // clearing `dirty`, and (c) on a forced retry send `expected_mtime: null`
  // so the backend skips its mtime check, matching the "overwrite anyway"
  // contract in files.py's `write()`.
  describe('mtime conflict', () => {
    beforeEach(() => {
      useFilesStore.setState({
        openPath: 'notes/todo.md',
        openContent: 'edited locally',
        openMtime: 111,
        openState: 'ready',
        dirty: true,
        conflict: false,
      });
    });

    it('save() sends the last-read mtime as expected_mtime', async () => {
      const { fetch, calls } = queueFetch([
        { status: 204 },
        { status: 200, body: { content: 'edited locally', mtime: 222, truncated: false } }, // re-read
        { status: 200, body: { entries } }, // refreshDir
      ]);
      global.fetch = fetch;

      await useFilesStore.getState().save();

      expect(calls[0].url).toBe('/api/files/write');
      expect(JSON.parse(String(calls[0].init?.body))).toEqual({
        path: 'notes/todo.md',
        content: 'edited locally',
        expected_mtime: 111,
      });
      expect(useFilesStore.getState().dirty).toBe(false);
      expect(useFilesStore.getState().conflict).toBe(false);
    });

    it('save() turns a 409 into conflict:true and leaves the edit unsaved (dirty stays true)', async () => {
      const { fetch } = queueFetch([{ status: 409, body: { detail: 'file changed on disk (mtime mismatch)' } }]);
      global.fetch = fetch;

      await useFilesStore.getState().save();

      const s = useFilesStore.getState();
      expect(s.conflict).toBe(true);
      expect(s.dirty).toBe(true); // the edit was NOT silently dropped or marked saved
      expect(s.openContent).toBe('edited locally'); // local edit preserved for the user to decide
    });

    it('save({ force: true }) after a conflict sends expected_mtime: null (server skips the check)', async () => {
      useFilesStore.setState({ conflict: true });
      const { fetch, calls } = queueFetch([
        { status: 204 },
        { status: 200, body: { content: 'edited locally', mtime: 333, truncated: false } },
        { status: 200, body: { entries } },
      ]);
      global.fetch = fetch;

      await useFilesStore.getState().save({ force: true });

      expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ expected_mtime: null });
      expect(useFilesStore.getState().conflict).toBe(false);
    });
  });

  it('mkdir() posts the joined path to POST /api/files/mkdir and refreshes the listing', async () => {
    useFilesStore.setState({ currentDir: 'notes' });
    const { fetch, calls } = queueFetch([
      { status: 204 },
      { status: 200, body: { entries } },
    ]);
    global.fetch = fetch;

    const ok = await useFilesStore.getState().mkdir('drafts');

    expect(ok).toBe(true);
    expect(calls[0].url).toBe('/api/files/mkdir');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ path: 'notes/drafts' });
    expect(calls[1].url).toBe('/api/files/tree?path=notes');
  });

  it('deleteSelected() posts selected paths to POST /api/files/delete with recursive:true by default', async () => {
    useFilesStore.setState({ selected: new Set(['notes/todo.md']) });
    const { fetch, calls } = queueFetch([
      { status: 204 },
      { status: 200, body: { entries: [] } },
    ]);
    global.fetch = fetch;

    const ok = await useFilesStore.getState().deleteSelected();

    expect(ok).toBe(true);
    expect(calls[0].url).toBe('/api/files/delete');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ paths: ['notes/todo.md'], recursive: true });
    expect(useFilesStore.getState().selected.size).toBe(0);
  });

  it('moveSelected() posts selected paths + dest to POST /api/files/move', async () => {
    useFilesStore.setState({ selected: new Set(['todo.md']) });
    const { fetch, calls } = queueFetch([
      { status: 204 },
      { status: 200, body: { entries } },
    ]);
    global.fetch = fetch;

    const ok = await useFilesStore.getState().moveSelected('notes');

    expect(ok).toBe(true);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ paths: ['todo.md'], dest: 'notes', overwrite: false });
  });
});
