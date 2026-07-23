import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilesArea } from './FilesArea';
import { useFilesStore } from '../../stores/filesStore';

function queueFetch(byUrl: (url: string, init?: RequestInit) => { status: number; body?: unknown }): typeof fetch {
  return async (url, init) => {
    const r = byUrl(String(url), init);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status,
      statusText: r.status < 300 ? 'OK' : 'Error',
      headers: r.body === undefined ? undefined : { 'content-type': 'application/json' },
    });
  };
}

const originalFetch = global.fetch;

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

describe('FilesArea (Files, D-FILES)', () => {
  beforeEach(resetStore);
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists the root directory on mount via GET /api/files/tree', async () => {
    global.fetch = queueFetch(() => ({
      status: 200,
      body: { entries: [{ name: 'notes.md', is_dir: false, size: 12, mtime: 1 }] },
    }));

    render(<FilesArea />);

    expect(await screen.findByText('notes.md')).toBeInTheDocument();
  });

  it('opening a file, editing it, and saving into a stale mtime shows the conflict banner and offers Reload / Overwrite anyway', async () => {
    const user = userEvent.setup();
    global.fetch = queueFetch((url) => {
      if (url.startsWith('/api/files/tree')) {
        return { status: 200, body: { entries: [{ name: 'notes.md', is_dir: false, size: 12, mtime: 1 }] } };
      }
      if (url.startsWith('/api/files/read')) {
        return { status: 200, body: { content: 'original', mtime: 100, truncated: false } };
      }
      if (url === '/api/files/write') {
        // Someone else changed the file on disk since we opened it.
        return { status: 409, body: { detail: 'file changed on disk (mtime mismatch)' } };
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<FilesArea />);

    await user.click(await screen.findByText('notes.md'));
    await waitFor(() => expect(screen.getByLabelText('file content')).toHaveValue('original'));

    await user.clear(screen.getByLabelText('file content'));
    await user.type(screen.getByLabelText('file content'), 'edited by me');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // This is the behaviour under test: a stale-mtime write surfaces the
    // conflict banner instead of silently failing or silently overwriting.
    expect(await screen.findByTestId('conflict-banner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overwrite anyway' })).toBeInTheDocument();
    // The edit itself must not have been discarded.
    expect(screen.getByLabelText('file content')).toHaveValue('edited by me');
  });
});
