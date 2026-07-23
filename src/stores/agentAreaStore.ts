import { create } from 'zustand';

export type AgentSubTab = 'overview' | 'chat';

interface AgentAreaStore {
  /** Which sub-view the Agent area is showing. Defaults to 'chat' — the
   * pre-existing Hermes chat surface wired at M5b — so entering /agent
   * behaves exactly as before until the user picks Overview. */
  subTab: AgentSubTab;
  setSubTab: (tab: AgentSubTab) => void;
}

/**
 * Agent area sub-navigation (Overview vs. Chat). Local to the Agent area —
 * unrelated to `uiStore`'s legacy chatMode/crmMode flags, which continue to
 * track area-level state via `useAreaRouteSync`.
 */
export const useAgentAreaStore = create<AgentAreaStore>((set) => ({
  subTab: 'chat',
  setSubTab: (tab) => set({ subTab: tab }),
}));
