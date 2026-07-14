// Fetches and normalizes the list of models exposed by an OpenAI-compatible
// provider at `{baseUrl}/models`. Intentionally kept free of React/store
// concerns so it can later be moved behind a Tauri/Rust IPC bridge.
//
// The shape we expect is the OpenAI list-models response:
//   { data: [{ id: string, owned_by?: string, ... }, ...] }
//
// Anything the endpoint does not explicitly state is left as a conservative
// "Unknown" capability — we never invent capabilities from the provider name.

import type { ModelCapability, ModelItem } from '../../types';
import { runtimeFetch } from '../http';

export type ProviderImportErrorCode =
  | 'invalid_url'
  | 'unauthorized'
  | 'request_failed'
  | 'empty_response'
  | 'malformed_response'
  | 'unsupported_shape'
  | 'database';

/** Result of a model-sync operation. */
export interface SyncModelsResult {
  ok: true;
  added: number;
  removed: number;
  unchanged: number;
  updatedAt: number | undefined;
}

export interface SyncModelsError {
  ok: false;
  error: string;
  code: string;
}

export class ProviderImportError extends Error {
  readonly code: ProviderImportErrorCode;
  readonly status?: number;

  constructor(code: ProviderImportErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ProviderImportError';
    this.code = code;
    this.status = status;
  }
}

export interface ImportProviderModelsInput {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  /**
   * Optional fetch override. Used by tests and any future non-browser bridge.
   * Defaults to the runtime-aware fetch implementation.
   */
  fetchImpl?: typeof fetch;
  /**
   * Optional abort signal to cancel an in-flight import.
   */
  signal?: AbortSignal;
}

export function normalizeProviderBaseUrl(input: string): string {
  return input
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:chat\/completions|models)$/i, '');
}

function defaultCapabilities(): ModelCapability {
  return {
    vision: false,
    toolCalling: true,
    contextLength: 'Unknown',
    speed: 'Unknown',
    cost: 'Unknown',
    reasoning: 'Unknown',
    endpointType: 'Native',
    lastSynced: 'Just now',
  };
}

function toModelItem(raw: unknown): ModelItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;

  const id =
    typeof entry.id === 'string' && entry.id.trim().length > 0
      ? entry.id.trim()
      : typeof entry.name === 'string' && entry.name.trim().length > 0
        ? entry.name.trim()
        : null;

  if (!id) return null;

  const name =
    typeof entry.name === 'string' && entry.name.trim().length > 0
      ? entry.name.trim()
      : id;

  return {
    id,
    name,
    enabled: true,
    capabilities: defaultCapabilities(),
  };
}

function extractModelArray(payload: unknown): unknown[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.models)) return obj.models;
  if (Array.isArray(obj)) return obj;

  return null;
}

export async function importProviderModels({
  providerId,
  baseUrl,
  apiKey,
  fetchImpl,
  signal,
}: ImportProviderModelsInput): Promise<ModelItem[]> {
  const normalizedUrl = normalizeProviderBaseUrl(baseUrl);
  if (!normalizedUrl) {
    throw new ProviderImportError(
      'invalid_url',
      'Base URL is required.'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw new ProviderImportError(
      'invalid_url',
      'Base URL is not a valid URL.'
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ProviderImportError(
      'invalid_url',
      'Base URL must use http or https.'
    );
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new ProviderImportError(
      'unauthorized',
      'API key is required.'
    );
  }

  const endpoint = `${normalizedUrl}/models`;
  const fetcher = fetchImpl ?? runtimeFetch;

  let response: Response;
  try {
    response = await fetcher(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        Accept: 'application/json',
      },
      signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Network request failed.';
    throw new ProviderImportError(
      'request_failed',
      `Could not reach ${providerId}: ${message}`
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ProviderImportError(
      'unauthorized',
      'API key was rejected by the provider (401/403).',
      response.status
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      detail = '';
    }
    throw new ProviderImportError(
      'request_failed',
      `Provider returned ${response.status}${detail ? `: ${detail}` : ''}.`,
      response.status
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderImportError(
      'malformed_response',
      'Provider returned a non-JSON response.'
    );
  }

  const rawList = extractModelArray(payload);
  if (!rawList) {
    throw new ProviderImportError(
      'unsupported_shape',
      'Provider response did not include a model list.'
    );
  }

  if (rawList.length === 0) {
    throw new ProviderImportError(
      'empty_response',
      'Provider returned an empty model list.'
    );
  }

  const seen = new Set<string>();
  const models: ModelItem[] = [];
  rawList.forEach((entry) => {
    const item = toModelItem(entry);
    if (!item) return;
    if (seen.has(item.id)) return;
    seen.add(item.id);
    models.push(item);
  });

  if (models.length === 0) {
    throw new ProviderImportError(
      'malformed_response',
      'Provider response did not contain any usable model entries.'
    );
  }

  return models;
}
