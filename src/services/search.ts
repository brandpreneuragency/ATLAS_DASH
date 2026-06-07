// Web search. The browser build hits `/api/ai/search`; the dormant Tauri
// desktop build uses the per-provider HTTP clients directly so the app
// can work without the server in the loop.
//
// See AGENTS.md for the Tauri isolation strategy: per-provider modules
// keep their original call signatures so the desktop re-merge is a
// no-op, but they lazily pick `globalThis.fetch` (browser) vs
// `@tauri-apps/plugin-http` (Tauri) via `fetchResolver`.

import type { SearchConfig } from '../types';
import { resolveFetch } from './ai/fetchResolver';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface WebExtractResult {
  url: string;
  content: string;
  title?: string;
}

const TAVILY_BASE = 'https://api.tavily.com';
const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilySearchResponse {
  results: TavilySearchResult[];
}

async function tavilySearch(apiKey: string, query: string, maxResults = 5): Promise<TavilySearchResponse> {
  const fetch = await resolveFetch();
  const res = await fetch(`${TAVILY_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, include_answer: false }),
  });
  if (!res.ok) throw new Error(`Tavily search failed (${res.status})`);
  return res.json() as Promise<TavilySearchResponse>;
}

async function firecrawlSearch(apiKey: string, query: string, limit = 5): Promise<{ data: { title: string; url: string; description: string }[] }> {
  const fetch = await resolveFetch();
  const res = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ['markdown'], onlyMainContent: true } }),
  });
  if (!res.ok) throw new Error(`Firecrawl search failed (${res.status})`);
  return res.json() as Promise<{ data: { title: string; url: string; description: string }[] }>;
}

export async function webSearch(
  config: SearchConfig,
  query: string,
  maxResults = 5
): Promise<WebSearchResult[]> {
  if (!config.enabled) throw new Error('Web search is disabled');

  switch (config.searchProvider) {
    case 'tavily': {
      if (!config.tavilyKey) throw new Error('Tavily API key not configured');
      const res = await tavilySearch(config.tavilyKey, query, maxResults);
      return res.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        score: r.score,
      }));
    }
    case 'firecrawl': {
      if (!config.firecrawlKey) throw new Error('Firecrawl API key not configured');
      const res = await firecrawlSearch(config.firecrawlKey, query, maxResults);
      return res.data.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));
    }
    default:
      throw new Error(`Unsupported search provider: ${config.searchProvider}`);
  }
}

export function formatSearchResultsForAI(results: WebSearchResult[]): string {
  if (results.length === 0) return '[No web search results found]';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
    .join('\n\n');
}
