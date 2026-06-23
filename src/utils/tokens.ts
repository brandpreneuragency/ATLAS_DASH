/**
 * Lightweight token estimator used for live context-window feedback
 * while streaming and as a fallback when a provider does not report
 * usage. It is intentionally simple and dependency-free.
 */

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function estimateMessageTokens(message: {
  content: string;
  selectedText?: string;
  attachments?: { dataUrl?: string; name?: string }[];
}): number {
  let total = estimateTokens(message.content);
  total += estimateTokens(message.selectedText);
  if (message.attachments?.length) {
    // Image attachments are hard to estimate locally; use a small fixed
    // placeholder so they are not invisible in the breakdown.
    total += message.attachments.length * 258;
  }
  return total;
}

export function parseContextLength(contextLength: string | undefined): number | null {
  if (!contextLength) return null;
  const normalized = contextLength.replace(/,/g, '').trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(k|m|b)?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const suffix = match[2];
  if (suffix === 'k') return Math.round(value * 1_000);
  if (suffix === 'm') return Math.round(value * 1_000_000);
  if (suffix === 'b') return Math.round(value * 1_000_000_000);
  return Math.round(value);
}
