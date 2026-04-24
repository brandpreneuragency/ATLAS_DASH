import { invoke } from '@tauri-apps/api/core';
import type { SearchResult } from '../types';

export async function invokeWebSearch(
  query: string,
  exaKey: string,
  tavilyKey: string,
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>('search_web', { query, exaKey, tavilyKey });
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
