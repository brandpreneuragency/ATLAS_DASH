import { invoke, isTauri } from '@tauri-apps/api/core';
import type { SearchConfig, SearchResult } from '../types';

export async function invokeWebSearch(
  query: string,
  config: Pick<SearchConfig, 'exaKey' | 'tavilyKey' | 'searchProvider'>,
): Promise<SearchResult[]> {
  if (!isTauri()) throw new Error('Web search requires the TABS desktop app.');
  return invoke<SearchResult[]>('search_web', {
    args: {
      query,
      exaKey: config.exaKey,
      tavilyKey: config.tavilyKey,
      provider: config.searchProvider,
    },
  });
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
