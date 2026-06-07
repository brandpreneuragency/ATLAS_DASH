// Centralised HTTP client for the TABS backend.
//
// Responsibilities (per plan.md § "Frontend Plan" / "API Client"):
//
//   * One place that knows the base URL (VITE_API_BASE_URL).
//   * JSON and multipart requests.
//   * `credentials: 'include'` on every call (the session cookie is HttpOnly).
//   * 401 detection — a thrown `ApiError` with `status: 401` lets the auth
//     store bounce the user back to the auth gate without leaking details.
//   * Error normalisation. Every non-2xx response becomes a typed `ApiError`
//     with `status`, `code`, `message`, and (for validation failures) `issues`.
//   * Abort signal support so stores can cancel in-flight requests.
//
// React components never import this file. Stores import it via repositories
// under `src/repositories/`. Repositories are the only place that knows the
// shape of an endpoint.
//
// Runtime: works in both the browser web build and the Tauri webview. There
// are no Tauri-only imports in this module — when the desktop bundle later
// wants to use a local SQLite / filesystem adapter for offline work, that
// adapter is added at the repository layer, not here.

const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api') as string;

const NORMALIZED_BASE_URL = (() => {
  // Allow relative (`/api`) and absolute (`http://localhost:4000/api`) bases.
  // We trim a trailing slash so `path` always concatenates with exactly one
  // separator.
  const trimmed = RAW_BASE_URL.replace(/\/+$/u, '');
  return trimmed.length > 0 ? trimmed : '/api';
})();

function buildUrl(path: string): string {
  if (/^https?:\/\//iu.test(path)) return path;
  const left = NORMALIZED_BASE_URL.endsWith('/') ? NORMALIZED_BASE_URL.slice(0, -1) : NORMALIZED_BASE_URL;
  const right = path.startsWith('/') ? path : `/${path}`;
  return `${left}${right}`;
}

// ── Error shape ─────────────────────────────────────────────────────────────

export interface ApiErrorPayload {
  status: number;
  code: string;
  message: string;
  issues?: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  issues?: unknown;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = payload.status;
    this.code = payload.code;
    this.issues = payload.issues;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400 && this.code === 'validation_error';
  }
}

// ── Public client ───────────────────────────────────────────────────────────

export interface RequestOptions {
  signal?: AbortSignal;
  /** Optional query string parameters. Values are URL-encoded. Arrays are
   *  joined with commas (the server splits on `,` — see
   *  `settingsKeysSchema`). */
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
}

export interface MultipartOptions {
  signal?: AbortSignal;
  /** Optional progress callback (0..1). */
  onProgress?: (loaded: number, total: number) => void;
  /** Optional query string parameters. */
  query?: Record<string, string | number | boolean | string[] | undefined | null>;
}

function appendQuery(url: string, query: RequestOptions['query']): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      params.append(k, v.join(','));
      continue;
    }
    params.append(k, String(v));
  }
  const qs = params.toString();
  if (qs.length === 0) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
}

function newAbortError(): Error {
  // `DOMException` is the standardised way to signal an aborted request. We
  // fall back to a plain Error on older runtimes.
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted.', 'AbortError');
  }
  const err = new Error('The operation was aborted.');
  err.name = 'AbortError';
  return err;
}

async function parseJson(res: Response): Promise<unknown> {
  // 204 No Content / empty body → `null`.
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Malformed body. Surface as a 500-ish generic error.
    return null;
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await parseJson(res)) as
    | { error?: string; message?: string; issues?: unknown }
    | null
    | undefined;
  return new ApiError({
    status: res.status,
    code: typeof body?.error === 'string' ? body.error : `http_${res.status}`,
    message:
      typeof body?.message === 'string'
        ? body.message
        : res.statusText || `Request failed with status ${res.status}`,
    issues: body?.issues,
  });
}

async function fetchJson<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const url = appendQuery(buildUrl(path), options.query);
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
    signal: options.signal ?? null,
  };
  if (body !== undefined) {
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || options.signal?.aborted)) {
      throw err;
    }
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: err instanceof Error ? err.message : 'Network request failed',
    });
  }
  if (!res.ok) throw await toApiError(res);
  return (await parseJson(res)) as T;
}

async function fetchMultipart<T>(path: string, form: FormData, options: MultipartOptions): Promise<T> {
  const url = appendQuery(buildUrl(path), options.query);
  let res: Response;
  try {
    if (options.signal?.aborted) throw newAbortError();

    res = await new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.withCredentials = true;
      xhr.responseType = 'json';
      xhr.upload.onprogress = (ev) => {
        if (options.onProgress && ev.lengthComputable) {
          options.onProgress(ev.loaded, ev.total);
        }
      };
      xhr.onload = () => {
        // Reconstruct a Response so the rest of the pipeline stays simple.
        const headers = new Headers();
        const raw = xhr.getAllResponseHeaders();
        if (raw) {
          for (const line of raw.split(/\r?\n/u)) {
            const idx = line.indexOf(':');
            if (idx > 0) headers.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
          }
        }
        const bodyText = xhr.responseText ?? '';
        resolve(
          new Response(bodyText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers,
          }),
        );
      };
      xhr.onerror = () =>
        reject(
          new ApiError({
            status: 0,
            code: 'network_error',
            message: 'Network request failed',
          }),
        );
      xhr.onabort = () => reject(newAbortError());
      xhr.ontimeout = () =>
        reject(
          new ApiError({
            status: 0,
            code: 'network_error',
            message: 'Network request timed out',
          }),
        );
      if (options.signal) {
        if (options.signal.aborted) {
          reject(newAbortError());
          return;
        }
        options.signal.addEventListener(
          'abort',
          () => {
            xhr.abort();
          },
          { once: true },
        );
      }
      xhr.send(form);
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || options.signal?.aborted)) {
      throw err;
    }
    throw err;
  }
  if (!res.ok) throw await toApiError(res);
  return (await parseJson(res)) as T;
}

export const apiClient = {
  baseUrl: NORMALIZED_BASE_URL,

  get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return fetchJson<T>('GET', path, undefined, options);
  },
  post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return fetchJson<T>('POST', path, body, options);
  },
  patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return fetchJson<T>('PATCH', path, body, options);
  },
  put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return fetchJson<T>('PUT', path, body, options);
  },
  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return fetchJson<T>('DELETE', path, undefined, options);
  },

  postMultipart<T>(path: string, form: FormData, options: MultipartOptions = {}): Promise<T> {
    return fetchMultipart<T>(path, form, options);
  },

  /**
   * Open a Server-Sent Events (SSE) stream to the backend. The server emits
   * `data: { "chunk": "..." }\n\n` for each text fragment, `data: { "done":
   * true }\n\n` to terminate, and `data: { "error": "..." }\n\n` on failure.
   * The callback receives a discriminated union so callers can `switch` on
   * the `type` field without leaking raw SSE details.
   *
   * 401 responses from the server are normalised to an `error` event with
   * `status: 401` so the auth store can react. Network failures (no
   * response, no events) are reported as a single `error` event.
   *
   * The returned `AbortController` lets the caller cancel the stream; abort
   * also closes the underlying `fetch` so bytes stop streaming.
   */
  stream(
    path: string,
    body: unknown,
    options: { signal?: AbortSignal } = {},
  ): { events: AsyncGenerator<StreamEvent>; cancel: () => void } {
    const url = appendQuery(buildUrl(path), undefined);
    const ctrl = new AbortController();
    // Forward caller abort to our internal controller.
    if (options.signal) {
      if (options.signal.aborted) ctrl.abort();
      else options.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }

    const events = (async function* () {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        yield {
          type: 'error',
          status: 0,
          message: err instanceof Error ? err.message : 'Network request failed',
        } as StreamEventError;
        return;
      }
      if (!res.ok || !res.body) {
        // Try to surface the server's `{ error, message }` body, falling back
        // to a status-only message.
        let message = res.statusText || `Request failed with status ${res.status}`;
        try {
          const text = await res.text();
          if (text.length > 0) {
            try {
              const parsed = JSON.parse(text) as { error?: string; message?: string };
              if (typeof parsed?.message === 'string') message = parsed.message;
            } catch {
              // not JSON — keep the statusText fallback
            }
          }
        } catch {
          // ignore body-read errors
        }
        yield { type: 'error', status: res.status, message } as StreamEventError;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneReceived = false;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE frames are separated by a blank line.
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const rawFrame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const event = parseSseFrame(rawFrame);
            if (!event) continue;
            if (event.type === 'done') {
              doneReceived = true;
              yield event;
              return;
            }
            yield event;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        yield {
          type: 'error',
          status: 0,
          message: err instanceof Error ? err.message : 'Stream read failed',
        } as StreamEventError;
        return;
      }
      // Stream ended without an explicit `done` frame. Synthesise one so the
      // caller can stop its loop.
      if (!doneReceived) yield { type: 'done' } as StreamEventDone;
    })();

    return { events, cancel: () => ctrl.abort() };
  },
};

export type StreamEvent =
  | { type: 'chunk'; chunk: string }
  | { type: 'done' }
  | { type: 'error'; status: number; message: string };

export interface StreamEventChunk {
  type: 'chunk';
  chunk: string;
}
export interface StreamEventDone {
  type: 'done';
}
export interface StreamEventError {
  type: 'error';
  status: number;
  message: string;
}

function parseSseFrame(frame: string): StreamEvent | null {
  // A frame can contain `event:`, `data:`, `id:`, `retry:` lines. The server
  // only emits `data:` so we collect just that.
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
    // Ignore `event:`, `id:`, `retry:`, comments (`:` prefix).
  }
  if (dataLines.length === 0) return null;
  const payload = dataLines.join('\n');
  let parsed: { chunk?: unknown; done?: unknown; error?: unknown; message?: unknown } | null = null;
  try {
    parsed = JSON.parse(payload) as { chunk?: unknown; done?: unknown; error?: unknown; message?: unknown };
  } catch {
    // Some servers emit a raw token in `data: foo`. Treat it as a chunk.
    return { type: 'chunk', chunk: payload };
  }
  if (typeof parsed?.chunk === 'string') return { type: 'chunk', chunk: parsed.chunk };
  if (parsed?.done === true) return { type: 'done' };
  if (typeof parsed?.error === 'string') {
    return { type: 'error', status: 500, message: parsed.error };
  }
  if (typeof parsed?.message === 'string') {
    return { type: 'error', status: 500, message: parsed.message };
  }
  return null;
}

export { ApiError as default };
