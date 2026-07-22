/**
 * Safe link helpers for rendering potentially untrusted persisted URLs.
 * Write-time validation is not enough for legacy/imported rows.
 */

export function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:";
}

/** Returns the URL only when safe for href; otherwise null. */
export function safeHref(value: unknown): string | null {
  if (!isSafeHttpUrl(value)) return null;
  return value.trim();
}

/** Display text for a URL-like value (always plain text safe). */
export function displayUrlText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}
