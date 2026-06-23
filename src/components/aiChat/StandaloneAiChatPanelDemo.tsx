import { useState } from 'react';
import { StandaloneAiChatPanel } from './StandaloneAiChatPanel';
import type { AiChatPanelMessage } from './types';

const MOCK_MESSAGES: AiChatPanelMessage[] = [
  {
    id: 'demo-1',
    role: 'user',
    content: 'Can you help me understand how this project is structured?',
    createdAt: new Date(Date.now() - 120000),
  },
  {
    id: 'demo-2',
    role: 'assistant',
    content:
      'Of course! This project follows a **layered architecture**:\n\n### Frontend\n- React with TypeScript\n- Zustand for state management\n- Dexie for local persistence\n\n### Backend\n- Express API server\n- Prisma ORM with Postgres\n- Docker deployment\n\n### Key Patterns\n1. **Bridge Pattern** — UI stays separate from data sources\n2. **Repository Layer** — stores call repositories, not APIs directly\n3. **Controlled Components** — parent owns state, components render UI\n\n```typescript\n// Example\nconst store = useMyStore();\nconst data = store.getData();\nreturn <MyComponent data={data} />;\n```\n\nThis keeps everything testable and maintainable.',
    createdAt: new Date(Date.now() - 60000),
  },
  {
    id: 'demo-3',
    role: 'user',
    content: 'What about the AI features?',
    createdAt: new Date(Date.now() - 30000),
  },
  {
    id: 'demo-4',
    role: 'assistant',
    content:
      'The AI integration supports multiple providers:\n\n- **OpenAI** (GPT-4, GPT-4o)\n- **Anthropic** (Claude)\n- **Google** (Gemini)\n\nEach provider goes through a server-side proxy to keep API keys secure. The chat supports markdown rendering, code blocks, and streaming responses.\n\n> Important: Provider API keys are never exposed to the frontend.',
    createdAt: new Date(Date.now() - 10000),
  },
];

const MOCK_LONG_MESSAGE: AiChatPanelMessage = {
  id: 'demo-long',
  role: 'assistant',
  content: `This is a longer assistant response to demonstrate how the panel handles extended content with markdown formatting.

### Section 1: Overview
The component handles long text naturally. Content wraps properly and the scroll area maintains smooth behavior. The composer stays pinned at the bottom.

### Section 2: Features
- Auto-scroll to latest message
- Markdown rendering with syntax highlighting
- Copy button on assistant messages
- Loading/streaming indicator
- Error state display

### Section 3: Styling
All styles reuse existing CSS variables and classes from the sidebar, ensuring visual consistency across the application. No new theme system was introduced.

\`\`\`javascript
// Code blocks render properly
function example() {
  return 'Hello, World!';
}
\`\`\`

The panel is designed to work at various widths — from sidebar width to full modal containers.`,
  createdAt: new Date(),
};

export function StandaloneAiChatPanelDemo() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<AiChatPanelMessage[]>(MOCK_MESSAGES);
  const [isSending, setIsSending] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [showLongMessage, setShowLongMessage] = useState(false);

  const handleSend = async (message: string) => {
    const userMsg: AiChatPanelMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSending(true);

    await new Promise((r) => setTimeout(r, 1500));

    const assistantMsg: AiChatPanelMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: `Echo: ${message}\n\nThis is a mock response from the demo. In production, this would come from the actual AI provider through the backend API.`,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsSending(false);
  };

  const handleStop = () => {
    setIsSending(false);
  };

  const activeMessages = showEmpty
    ? []
    : showLongMessage
    ? [...MOCK_MESSAGES, MOCK_LONG_MESSAGE]
    : messages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--c-background-1)' }}>
      {/* Controls bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--c-border-1)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span className="semibold" style={{ fontSize: 'var(--fs-xs)', marginRight: 8 }}>Demo Controls:</span>
        <button
          type="button"
          onClick={() => { setShowEmpty(false); setShowLongMessage(false); setMessages(MOCK_MESSAGES); }}
          className="drop-item"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          Default
        </button>
        <button
          type="button"
          onClick={() => { setShowEmpty(true); }}
          className="drop-item"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          Empty
        </button>
        <button
          type="button"
          onClick={() => { setShowLongMessage(true); setShowEmpty(false); }}
          className="drop-item"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          Long Message
        </button>
        <button
          type="button"
          onClick={() => setShowError((v) => !v)}
          className="drop-item"
          style={{ fontSize: 'var(--fs-sm)', color: showError ? '#e53e3e' : undefined }}
        >
          {showError ? 'Clear Error' : 'Show Error'}
        </button>
        <button
          type="button"
          onClick={() => setShowDisabled((v) => !v)}
          className="drop-item"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          {showDisabled ? 'Enable' : 'Disable Input'}
        </button>
        <button
          type="button"
          onClick={() => {
            const pending: AiChatPanelMessage = {
              id: `pending-${Date.now()}`,
              role: 'assistant',
              content: '',
              isPending: true,
            };
            setMessages((prev) => [...prev, pending]);
            setIsSending(true);
          }}
          className="drop-item"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          Loading State
        </button>
      </div>

      {/* Panel */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <StandaloneAiChatPanel
          title="AI Assistant"
          subtitle="Demo Preview"
          messages={activeMessages}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onStop={isSending ? handleStop : undefined}
          isSending={isSending}
          isDisabled={showDisabled}
          error={showError ? 'This is a simulated error message.' : null}
          placeholder="Ask anything..."
          modelLabel="GPT-4o"
          profileLabel="General"
        />
      </div>
    </div>
  );
}
