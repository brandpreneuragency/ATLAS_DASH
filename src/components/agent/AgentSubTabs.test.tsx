import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentSubTabs } from './AgentSubTabs';
import { useAgentAreaStore } from '../../stores/agentAreaStore';

describe('AgentSubTabs', () => {
  beforeEach(() => {
    useAgentAreaStore.setState({ subTab: 'chat' });
  });

  it('renders exactly the seven ratified Agent sub-tabs, including one — and only one — Chat tab', () => {
    render(<AgentSubTabs />);

    const tablist = screen.getByRole('tablist', { name: 'Agent views' });
    const tabs = tablist.querySelectorAll('[role="tab"]');

    expect(tabs).toHaveLength(7);
    expect(Array.from(tabs).map((t) => t.textContent)).toEqual([
      'Overview',
      'Chat',
      'Runs',
      'Workflows',
      'Schedules',
      'Browser AI',
      'Brain Review',
    ]);
    // Exactly one tab labeled "Chat" — no second Hermes chat presentation
    // hiding under another label (D-CHAT).
    expect(screen.getAllByRole('tab', { name: 'Chat' })).toHaveLength(1);
  });

  it('defaults to the Chat sub-tab selected', () => {
    render(<AgentSubTabs />);
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking Browser AI selects it and deselects Chat', async () => {
    const user = userEvent.setup();
    render(<AgentSubTabs />);

    await user.click(screen.getByRole('tab', { name: 'Browser AI' }));

    expect(screen.getByRole('tab', { name: 'Browser AI' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'false');
    expect(useAgentAreaStore.getState().subTab).toBe('browserAi');
  });

  it('clicking Brain Review selects it', async () => {
    const user = userEvent.setup();
    render(<AgentSubTabs />);

    await user.click(screen.getByRole('tab', { name: 'Brain Review' }));

    expect(useAgentAreaStore.getState().subTab).toBe('brainReview');
  });
});
