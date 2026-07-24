import type { SearchConfig, SearchResult } from '../types';
import { runtimeFetch } from './http';

export async function invokeWebSearch(
  query: string,
  config: Pick<SearchConfig, 'exaKey' | 'tavilyKey' | 'searchProvider'>,
): Promise<SearchResult[]> {
  return searchInBrowser(query, config);
}

async function searchInBrowser(
  query: string,
  config: Pick<SearchConfig, 'exaKey' | 'tavilyKey' | 'searchProvider'>,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) throw new Error('Search query is empty.');

  const provider = (config.searchProvider ?? '').toLowerCase();
  const chosen =
    provider === 'exa' && config.exaKey
      ? 'exa'
      : provider === 'tavily' && config.tavilyKey
        ? 'tavily'
        : config.tavilyKey
          ? 'tavily'
          : config.exaKey
            ? 'exa'
            : null;

  if (!chosen) {
    throw new Error(
      'No search API key configured. Add a Tavily or Exa key in Settings.',
    );
  }

  if (chosen === 'tavily') return searchTavily(q, config.tavilyKey!);
  return searchExa(q, config.exaKey!);
}

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  const resp = await runtimeFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: 'basic',
      include_answer: false,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Tavily returned ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? r.url ?? '',
    url: r.url ?? '',
    snippet: r.content ?? '',
  }));
}

async function searchExa(query: string, apiKey: string): Promise<SearchResult[]> {
  const resp = await runtimeFetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: 5,
      useAutoprompt: false,
      contents: { text: { maxCharacters: 800 } },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Exa returned ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      highlights?: string[];
    }>;
  };
  return (data.results ?? []).map((r) => ({
    title: r.title ?? r.url ?? '',
    url: r.url ?? '',
    snippet: r.highlights?.[0] ?? r.text ?? '',
  }));
}

export function formatSearchResultsAsContext(results: SearchResult[]): string {
  if (results.length === 0) return '';
  const items = results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join('\n\n');
  return (
    'You have access to the following live web search results. ' +
    'Use them to answer questions about recent or current information. ' +
    'Cite the source URL when you use a result.\n\n' +
    `<search_results>\n${items}\n</search_results>`
  );
}
