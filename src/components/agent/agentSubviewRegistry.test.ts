import { describe, it, expect } from 'vitest';
import { AGENT_SUBVIEW_REGISTRY } from './agentSubviewRegistry';
import { ChatWorkspace } from '../chatMode/ChatWorkspace';
import { BrowserAiChat } from './BrowserAiChat';
import { BrainReview } from './BrainReview';

/**
 * D-CHAT (M2 module map, ratified): "Control's Agent.tsx, Sessions.tsx and
 * SessionDetail.tsx all collapse into ONE presentation built on DASH
 * chatMode/... it is not retained as a second chat presentation." This test
 * exercises `AGENT_SUBVIEW_REGISTRY` — the single map `AuthenticatedShell`
 * reads to decide what renders under each Agent sub-tab — and fails if a
 * future change reintroduces a second Hermes chat presentation, or quietly
 * routes Browser AI / Brain Review through the Hermes chat component
 * instead of their own.
 */
describe('AGENT_SUBVIEW_REGISTRY (D-CHAT)', () => {
  it('maps exactly one Agent sub-tab to the single Hermes chat presentation (ChatWorkspace)', () => {
    const chatEntries = Object.entries(AGENT_SUBVIEW_REGISTRY).filter(
      ([, Component]) => Component === ChatWorkspace,
    );
    expect(chatEntries).toHaveLength(1);
    expect(chatEntries[0][0]).toBe('chat');
  });

  it('Browser AI is wired to its own direct-provider component, not the Hermes chat', () => {
    expect(AGENT_SUBVIEW_REGISTRY.browserAi).toBe(BrowserAiChat);
    expect(AGENT_SUBVIEW_REGISTRY.browserAi).not.toBe(ChatWorkspace);
  });

  it('Brain Review is wired to its own review-queue component, not the Hermes chat', () => {
    expect(AGENT_SUBVIEW_REGISTRY.brainReview).toBe(BrainReview);
    expect(AGENT_SUBVIEW_REGISTRY.brainReview).not.toBe(ChatWorkspace);
  });

  it('every registered sub-tab maps to a distinct component (no aliasing)', () => {
    const components = Object.values(AGENT_SUBVIEW_REGISTRY);
    expect(new Set(components).size).toBe(components.length);
  });

  it('registers exactly the seven ratified Agent sub-tabs — no more, no fewer', () => {
    expect(Object.keys(AGENT_SUBVIEW_REGISTRY).sort()).toEqual(
      ['brainReview', 'browserAi', 'chat', 'overview', 'runs', 'schedules', 'workflows'].sort(),
    );
  });
});
