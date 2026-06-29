// UTM + source attribution capture for embedded forms.
//
// Pure helpers — no React, no Dexie. The FormRenderer calls
// `collectUtmAndSourceData()` on submit and then `pickEnabledUtm(...)` to keep
// only the UTM fields the form has enabled (defaults to all).
//
// Safe in non-browser environments (Tauri webview always has DOM, but the
// guards keep this unit-testable).

import type { CRMUtmData } from '../../../types/crm';

const UTM_QUERY_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

const LANDING_PAGE_STORAGE_KEY = 'tabs_form_landing_page';

/** Every key we know how to capture, in stable order. */
export const ALL_UTM_KEYS = [
  ...UTM_QUERY_KEYS,
  'referrer',
  'landing_page',
  'page_url',
  'device_type',
  'submitted_at',
] as const;

export type UtmKeyName = (typeof ALL_UTM_KEYS)[number];

function readParam(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  return raw && raw.trim() !== '' ? raw.trim() : undefined;
}

function detectDeviceType(): string {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'desktop';
  }
  if (window.matchMedia('(max-width: 480px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 768px)').matches) return 'tablet';
  return 'desktop';
}

/**
 * First-landing capture. On the first visit in a session we persist the current
 * href to sessionStorage and reuse it on subsequent navigations so attribution
 * points to the true entry page, not whatever page the form was submitted from.
 */
function getLandingPage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.sessionStorage.getItem(LANDING_PAGE_STORAGE_KEY);
    if (stored && stored.trim() !== '') return stored;
    const href = window.location.href;
    window.sessionStorage.setItem(LANDING_PAGE_STORAGE_KEY, href);
    return href;
  } catch {
    // sessionStorage may be disabled (private mode / sandbox) — fall back to href.
    try {
      return window.location.href;
    } catch {
      return undefined;
    }
  }
}

/**
 * Collect every UTM / source field we can see from the current environment.
 * Caller filters down via `pickEnabledUtm`.
 */
export function collectUtmAndSourceData(): CRMUtmData {
  const searchParams =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

  const referrer =
    typeof document !== 'undefined' && typeof document.referrer === 'string' && document.referrer.trim() !== ''
      ? document.referrer.trim()
      : undefined;

  let referrerParams: URLSearchParams | null = null;
  if (referrer) {
    try {
      referrerParams = new URLSearchParams(new URL(referrer).search);
    } catch {
      referrerParams = null;
    }
  }

  const pick = (key: string): string | undefined =>
    readParam(searchParams, key) ?? (referrerParams ? readParam(referrerParams, key) : undefined);

  const data: CRMUtmData = {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_term: pick('utm_term'),
    utm_content: pick('utm_content'),
    referrer,
    landing_page: getLandingPage(),
    page_url:
      typeof window !== 'undefined' && typeof window.location.href === 'string'
        ? window.location.href
        : undefined,
    device_type: detectDeviceType(),
    submitted_at: new Date().toISOString(),
  };

  return data;
}

/**
 * Return a CRMUtmData containing only the keys present in `enabledSet`.
 * Undefined values are dropped so hiddenFields stays clean. Defaults to the
 * full set when no enabled set is supplied.
 */
export function pickEnabledUtm(
  all: CRMUtmData,
  enabledSet: ReadonlySet<string>,
): CRMUtmData {
  const picked: CRMUtmData = {};
  for (const key of ALL_UTM_KEYS) {
    if (!enabledSet.has(key)) continue;
    const value = all[key];
    if (value !== undefined && value !== '') {
      (picked as Record<string, string>)[key] = value;
    }
  }
  return picked;
}

/** Default enabled set = every key we capture. */
export const DEFAULT_ENABLED_UTM: ReadonlySet<string> = new Set<string>(ALL_UTM_KEYS);
