// Server-side web search service.
//
// The browser never calls Tavily / Firecrawl / Exa / Brave directly — that
// would expose the user's API keys. Instead the web build sends a request
// to `/api/ai/search` and the server uses the user's stored encrypted
// search keys (see `Setting` row `searchConfig`) to call the provider.
//
// The wire shape matches the previous `services/search.ts` in the
// frontend so the client store doesn't need a new shape.

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
}

export interface WebSearchConfig {
  exaKey: string;
  tavilyKey: string;
  firecrawlKey: string;
  braveKey: string;
  enabled: boolean;
  searchProvider: 'tavily' | 'firecrawl' | 'exa' | 'brave';
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

interface FirecrawlSearchResponse {
  data: { title: string; url: string; description: string }[];
}

async function tavilySearch(apiKey: string, query: string, maxResults: number): Promise<TavilySearchResponse> {
  const res = await fetch(`${TAVILY_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      include_answer: false,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Tavily search failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as TavilySearchResponse;
}

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit: number,
): Promise<FirecrawlSearchResponse> {
  const res = await fetch(`${FIRECRAWL_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      limit,
      scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Firecrawl search failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return (await res.json()) as FirecrawlSearchResponse;
}

export async function webSearch(
  config: WebSearchConfig,
  query: string,
  maxResults = 5,
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
    case 'exa': {
      throw new Error('Exa search is not yet supported on the server. Switch to tavily or firecrawl.');
    }
    case 'brave': {
      throw new Error('Brave search is not yet supported on the server. Switch to tavily or firecrawl.');
    }
    default: {
      // Exhaustive check
      const _exhaustive: never = config.searchProvider;
      throw new Error(`Unsupported search provider: ${String(_exhaustive)}`);
    }
  }
}

/** Format the search results into a text block the model can read. */
export function formatSearchResultsForAI(results: WebSearchResult[]): string {
  if (results.length === 0) return '[No web search results found]';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
    .join('\n\n');
}
