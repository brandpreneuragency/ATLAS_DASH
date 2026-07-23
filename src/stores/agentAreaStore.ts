import { create } from 'zustand';

export type AgentSubTab =
  | 'overview'
  | 'chat'
  | 'runs'
  | 'workflows'
  | 'schedules'
  | 'browserAi'
  | 'brainReview';

interface AgentAreaStore {
  /** Which sub-view the Agent area is showing. Defaults to 'chat' — the
   * pre-existing Hermes chat surface wired at M5b — so entering /agent
   * behaves exactly as before until the user picks another sub-tab. */
  subTab: AgentSubTab;
  setSubTab: (tab: AgentSubTab) => void;
}

/**
 * Agent area sub-navigation (Overview / Chat / Runs / Workflows /
 * Schedules / Browser AI / Brain Review). Local to the Agent area —
 * unrelated to `uiStore`'s legacy chatMode/crmMode flags, which continue to
 * track area-level state via `useAreaRouteSync`. `chat` is the single
 * Hermes chat presentation (D-CHAT); `browserAi` and `brainReview` are
 * deliberately separate presentations — see
 * `src/components/agent/agentSubviewRegistry.ts`.
 */
export const useAgentAreaStore = create<AgentAreaStore>((set) => ({
  subTab: 'chat',
  setSubTab: (tab) => set({ subTab: tab }),
}));
