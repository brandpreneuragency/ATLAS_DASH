import type { ComponentType } from 'react';
import type { AgentSubTab } from '../../stores/agentAreaStore';
import { AgentOverview } from './AgentOverview';
import { AgentRuns } from './AgentRuns';
import { AgentWorkflows } from './AgentWorkflows';
import { Schedules } from './Schedules';
import { BrowserAiChat } from './BrowserAiChat';
import { BrainReview } from './BrainReview';
import { ChatWorkspace } from '../chatMode/ChatWorkspace';

/**
 * Single source of truth for "which component renders which Agent sub-tab".
 * `AuthenticatedShell` and any test asserting D-CHAT (exactly one Hermes
 * chat presentation reachable in the UI) both read this map instead of each
 * carrying their own copy of the switch, so the two can never drift apart.
 *
 * `chat` is the ONLY key allowed to map to `ChatWorkspace` — the single
 * Hermes chat presentation (session list + message history) per the M2 map's
 * D-CHAT ratification. `browserAi` (the direct-provider surface) and
 * `brainReview` (the guarded brain-workflow queue) are deliberately distinct
 * components; neither routes through Hermes.
 */
export const AGENT_SUBVIEW_REGISTRY: Record<AgentSubTab, ComponentType> = {
  overview: AgentOverview,
  chat: ChatWorkspace,
  runs: AgentRuns,
  workflows: AgentWorkflows,
  schedules: Schedules,
  browserAi: BrowserAiChat,
  brainReview: BrainReview,
};
