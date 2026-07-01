// Settings-mode AI sidebar.
//
// Mounted in the right column of the Settings 3-column page template.
// The visual structure is the **same** as the task-mode AI sidebar
// (`AISidebarPanel` + `AISidebar` + `RightPanelSubheader` + `ChatThread`
// + `ChatInput`) so it picks up the existing styles, threading, and
// composer behaviour for free.
//
// The only thing that differs is the chat context: instead of a
// `documentId` or `taskId`, threads and messages are scoped to a
// Settings sub-tab via the `settingsTab` field on `chatStore` and
// `useStreamingChat`. Each sub-tab therefore has its own fully
// independent thread list, persisted in IndexedDB.
//
// The component is split into three sub-components (`.Header`,
// `.Body`, `.Footer`) so it can fill the `rightHeader` / `rightMain` /
// `rightFooter` slots of `ReusablePageTemplate` exactly the way
// `#right-panel-subheader` / `#ai-sidebar` / `.ai-sidebar-composer` do
// in the task mode shell.

import { useState } from 'react';
import { Clock } from 'lucide-react';
import type { SettingsSubTab } from '../../stores/uiStore';
import { useChatStore } from '../../stores/chatStore';
import { useUIStore } from '../../stores/uiStore';
import { RightPanelSubheader } from '../sidebar/RightPanelSubheader';
import { ChatThread } from '../sidebar/ChatThread';
import { ChatInput } from '../sidebar/ChatInput';
import type { ChatMessage } from '../../types';
import './settingsAiSidebar.css';

/* -------------------------------------------------------------------------- */
/* Per-tab helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Push the active sub-tab onto the chat store so threads scoped to that
 * tab become the visible list. Returns the resolved settings tab id.
 */
function useSettingsTab(tab: SettingsSubTab): string {
  const setActiveContext = useChatStore((s) => s.setActiveContext);
  setActiveContext({ settingsTab: tab });
  return tab;
}

/* -------------------------------------------------------------------------- */
/* Header (slot: rightHeader)                                                  */
/* -------------------------------------------------------------------------- */

interface SettingsAISidebarHeaderProps {
  tab: SettingsSubTab;
}

/** `rightHeader` slot — renders the same `RightPanelSubheader` used by
 *  the task mode AI sidebar, configured to drive the settings chat
 *  context. The panel-swap button is hidden because the settings page
 *  has a fixed 3-column layout (the chat can't move to the center). */
function SettingsAISidebarHeader({ tab }: SettingsAISidebarHeaderProps) {
  return (
    <RightPanelSubheader
      mode="writer"
      settingsTab={tab}
      hideSwapButton
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Body (slot: rightMain) — empty state + chat thread                          */
/* -------------------------------------------------------------------------- */

interface SettingsAISidebarBodyProps {
  tab: SettingsSubTab;
}

function SettingsAISidebarBody({ tab }: SettingsAISidebarBodyProps) {
  useSettingsTab(tab);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const getActiveThreadMessages = useChatStore((s) => s.getActiveThreadMessages);
  const activeMessages = getActiveThreadMessages();
  const showEmptyState = !activeThreadId || activeMessages.length === 0;
  const aiSidebarOpen = useUIStore((s) => s.aiSidebarOpen);

  if (!aiSidebarOpen) return null;

  return (
    <div className="settings-ai-sidebar-body">
      <div className="panel-body ai-scroll-host flex-1 min-h-0 settings-ai-sidebar-body-scroll">
        {showEmptyState ? (
          <div id="chat-empty-state" className="panel-body empty-state chat-empty-state h-full">
            <div className="chat-empty-state-icon">
              <Clock size={32} />
            </div>
            <p className="chat-empty-state-title">Start a conversation</p>
            <p className="chat-empty-state-subtitle subtle">
              Send a message to begin chatting about this settings page.
            </p>
          </div>
        ) : (
          <ChatThread
            documentId={null}
            taskId={null}
            editor={null}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer (slot: rightFooter) — composer (matches task mode `.ai-sidebar-composer`)  */
/* -------------------------------------------------------------------------- */

interface SettingsAISidebarFooterProps {
  tab: SettingsSubTab;
}

function SettingsAISidebarFooter({ tab }: SettingsAISidebarFooterProps) {
  useSettingsTab(tab);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const aiSidebarOpen = useUIStore((s) => s.aiSidebarOpen);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

  if (!aiSidebarOpen) return null;

  return (
    <div className="ai-sidebar-composer panel-footer settings-ai-sidebar-footer">
      <ChatInput
        mode="writer"
        threadId={activeThreadId ?? ''}
        documentId={null}
        taskId={null}
        settingsTab={tab}
        replyToMessage={replyToMessage}
        onClearReply={() => setReplyToMessage(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Public namespace                                                            */
/* -------------------------------------------------------------------------- */

export const SettingsAISidebar = {
  Header: SettingsAISidebarHeader,
  Body: SettingsAISidebarBody,
  Footer: SettingsAISidebarFooter,
};
