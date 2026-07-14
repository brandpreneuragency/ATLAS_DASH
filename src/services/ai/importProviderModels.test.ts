import { describe, it, expect } from 'vitest';
import {
  importProviderModels,
  normalizeProviderBaseUrl,
  ProviderImportError,
} from './importProviderModels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, init?: { status?: number; ok?: boolean; headers?: Record<string, string> }): typeof fetch {
  const status = init?.status ?? 200;
  const ok = init?.ok ?? (status >= 200 && status < 300);
  return async (_url: string | URL | Request, _opts?: RequestInit) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    return new Response(JSON.stringify(body), {
      status,
      statusText: ok ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  };
}

function mockFetchText(body: string, init?: { status?: number }): typeof fetch {
  const status = init?.status ?? 200;
  return async () => {
    return new Response(body, {
      status,
      statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
      headers: { 'content-type': 'text/plain' },
    });
  };
}

function mockFetchNetworkError(): typeof fetch {
  return async () => {
    throw new TypeError('Failed to fetch');
  };
}

function mockFetchAbort(): typeof fetch {
  return async (_url: string | URL | Request, _opts?: RequestInit) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Simulate the signal being aborted
    const err = new DOMException('The operation was aborted.', 'AbortError');
    throw err;
  };
}

const BASE_URL = 'https://api.example.com/v1';
const API_KEY = 'sk-test-key-123';
const PROVIDER_ID = 'test-provider';

// ---------------------------------------------------------------------------
// normalizeProviderBaseUrl
// ---------------------------------------------------------------------------

describe('normalizeProviderBaseUrl', () => {
  it('trims whitespace', () => {
    expect(normalizeProviderBaseUrl('  https://api.example.com  ')).toBe('https://api.example.com');
  });

  it('strips trailing slashes', () => {
    expect(normalizeProviderBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
    expect(normalizeProviderBaseUrl('https://api.example.com///')).toBe('https://api.example.com');
  });

  it('removes /chat/completions suffix', () => {
    expect(normalizeProviderBaseUrl('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1');
  });

  it('removes /models suffix', () => {
    expect(normalizeProviderBaseUrl('https://api.example.com/v1/models')).toBe('https://api.example.com/v1');
  });

  it('handles combined trailing slash and endpoint', () => {
    expect(normalizeProviderBaseUrl('https://api.example.com/v1/models/')).toBe('https://api.example.com/v1');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeProviderBaseUrl('   ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// importProviderModels
// ---------------------------------------------------------------------------

describe('importProviderModels', () => {
  const validResponse = {
    data: [
      { id: 'gpt-4o', owned_by: 'openai' },
      { id: 'gpt-4o-mini', owned_by: 'openai' },
    ],
  };

  it('parses OpenAI-style { data: [...] } response', async () => {
    const models = await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: mockFetch(validResponse),
    });

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'gpt-4o',
      name: 'gpt-4o',
      enabled: true,
    });
    expect(models[1].id).toBe('gpt-4o-mini');
  });

  it('parses { models: [...] } response shape', async () => {
    const models = await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: mockFetch({ models: [{ id: 'llama3' }] }),
    });

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('llama3');
  });

  it('parses bare array response', async () => {
    const models = await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: mockFetch([{ id: 'model-a' }, { id: 'model-b' }]),
    });

    expect(models).toHaveLength(2);
  });

  it('uses entry.name as fallback when entry.id is missing', async () => {
    const models = await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: mockFetch({ data: [{ name: 'fallback-model' }] }),
    });

    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('fallback-model');
    expect(models[0].name).toBe('fallback-model');
  });

  it('deduplicates models by id', async () => {
    const models = await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: mockFetch({
        data: [
          { id: 'gpt-4o' },
          { id: 'gpt-4o' },
          { id: 'gpt-4o-mini' },
        ],
      }),
    });

    expect(models).toHaveLength(2);
  });

  it('assigns default capabilities to all models', async () => {
    const models = await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: mockFetch(validResponse),
    });

    expect(models[0].capabilities).toMatchObject({
      vision: false,
      toolCalling: true,
      speed: 'Unknown',
      cost: 'Unknown',
      reasoning: 'Unknown',
      endpointType: 'Native',
    });
  });

  // --- Error cases ---

  it('throws invalid_url for empty base URL', async () => {
    await expect(
      importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: '',
        apiKey: API_KEY,
        fetchImpl: mockFetch({}),
      }),
    ).rejects.toThrow(ProviderImportError);

    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: '',
        apiKey: API_KEY,
        fetchImpl: mockFetch({}),
      });
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderImportError);
      expect((err as ProviderImportError).code).toBe('invalid_url');
    }
  });

  it('throws invalid_url for malformed URL', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: 'not-a-url',
        apiKey: API_KEY,
        fetchImpl: mockFetch({}),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('invalid_url');
    }
  });

  it('throws invalid_url for non-http protocol', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: 'ftp://example.com',
        apiKey: API_KEY,
        fetchImpl: mockFetch({}),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('invalid_url');
    }
  });

  it('throws unauthorized for empty API key', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: '',
        fetchImpl: mockFetch({}),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('unauthorized');
    }
  });

  it('throws unauthorized for whitespace-only API key', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: '   ',
        fetchImpl: mockFetch({}),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('unauthorized');
    }
  });

  it('throws unauthorized on 401 response', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetch({ error: 'Unauthorized' }, { status: 401 }),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('unauthorized');
      expect((err as ProviderImportError).status).toBe(401);
    }
  });

  it('throws unauthorized on 403 response', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetch({ error: 'Forbidden' }, { status: 403 }),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('unauthorized');
    }
  });

  it('throws request_failed on 500 response', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetch({ error: 'Internal Server Error' }, { status: 500 }),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('request_failed');
      expect((err as ProviderImportError).status).toBe(500);
    }
  });

  it('throws request_failed on network error', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetchNetworkError(),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('request_failed');
    }
  });

  it('throws AbortError directly on abort', async () => {
    await expect(
      importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetchAbort(),
      }),
    ).rejects.toThrow(DOMException);
  });

  it('throws malformed_response for non-JSON response', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetchText('not json at all'),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('malformed_response');
    }
  });

  it('throws unsupported_shape for object without data/models array', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetch({ someOtherField: 'value' }),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('unsupported_shape');
    }
  });

  it('throws empty_response for empty model list', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetch({ data: [] }),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('empty_response');
    }
  });

  it('throws malformed_response when all entries are invalid', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: API_KEY,
        fetchImpl: mockFetch({ data: [null, {}, { id: '' }] }),
      });
    } catch (err) {
      expect((err as ProviderImportError).code).toBe('malformed_response');
    }
  });

  it('sends correct Authorization header', async () => {
    let capturedHeaders: Headers | undefined;
    const fetchSpy: typeof fetch = async (_url, opts) => {
      capturedHeaders = new Headers(opts?.headers as HeadersInit);
      return new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      fetchImpl: fetchSpy,
    });

    expect(capturedHeaders?.get('Authorization')).toBe(`Bearer ${API_KEY}`);
  });

  it('trims trailing slash from URL before fetching', async () => {
    let capturedUrl: string | undefined;
    const fetchSpy: typeof fetch = async (url) => {
      capturedUrl = typeof url === 'string' ? url : url.toString();
      return new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    await importProviderModels({
      providerId: PROVIDER_ID,
      baseUrl: 'https://api.example.com/v1/',
      apiKey: API_KEY,
      fetchImpl: fetchSpy,
    });

    expect(capturedUrl).toBe('https://api.example.com/v1/models');
  });

  it('does not expose API key in error messages', async () => {
    try {
      await importProviderModels({
        providerId: PROVIDER_ID,
        baseUrl: BASE_URL,
        apiKey: '',
        fetchImpl: mockFetch({}),
      });
    } catch (err) {
      expect((err as Error).message).not.toContain(API_KEY);
    }
  });
});
