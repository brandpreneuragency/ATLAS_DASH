// Tiny UI-state store for the Activities page date-range filter.
// The CRM store (owned by the Data Model agent) only exposes an
// activity `type` filter, so the date range lives here as a local
// UI concern shared between Panel 1 (ActivityFilters) and Panel 2
// (CRMActivitiesPage). Scoped to the CRM module — no global state.

import { create } from 'zustand';

export type ActivityDateRange = '' | 'today' | '7d' | '30d';

interface ActivityFilterUIState {
  dateRange: ActivityDateRange;
  setDateRange: (r: ActivityDateRange) => void;
}

export const useActivityFilterUI = create<ActivityFilterUIState>((set) => ({
  dateRange: '',
  setDateRange: (dateRange) => set({ dateRange }),
}));

export function inActivityDateRange(iso: string, range: ActivityDateRange): boolean {
  if (!range) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  if (range === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return t >= d.getTime();
  }
  const days = range === '7d' ? 7 : 30;
  return t >= now - days * 24 * 60 * 60 * 1000;
}
