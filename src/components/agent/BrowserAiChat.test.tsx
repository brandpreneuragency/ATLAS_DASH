import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserAiChat } from './BrowserAiChat';
import { useBrowserAiChatStore } from '../../stores/browserAiChatStore';
import { useAIStore } from '../../stores/aiStore';

const originalGetActiveProvider = useAIStore.getState().getActiveProvider;

// A stable object reference is required: zustand's `useSyncExternalStore`
// selector (`s.getActiveProvider()`) must return the *same* reference across
// renders when nothing changed, or React treats every render as a fresh
// external-store update and loops. The real store satisfies this by reading
// from `providerConfigs` (stable until a config actually changes) — mirror
// that here instead of allocating a new object literal per call.
const CONFIGURED_PROVIDER = {
  id: 'p1',
  name: 'My OpenAI',
  provider: 'openai-compatible',
  apiKey: 'sk-x',
  selectedModel: 'gpt-4o',
  isActive: true,
  baseUrl: 'https://api.openai.com/v1',
  customModels: [],
};

describe('BrowserAiChat (Agent -> Browser AI wiring)', () => {
  afterEach(() => {
    useAIStore.setState({ getActiveProvider: originalGetActiveProvider });
    useBrowserAiChatStore.setState({ messages: [], inputValue: '', isSending: false, error: null });
  });

  it('disables the composer and shows a Settings prompt when no provider is configured', () => {
    useAIStore.setState({ getActiveProvider: () => null });

    render(<BrowserAiChat />);

    expect(screen.getByPlaceholderText('Connect an AI provider in Settings to chat.')).toBeDisabled();
  });

  it('shows the active provider name and model once one is configured', () => {
    useAIStore.setState({ getActiveProvider: () => CONFIGURED_PROVIDER });

    render(<BrowserAiChat />);

    expect(screen.getByPlaceholderText('Ask anything…')).toBeEnabled();
    expect(screen.getByText('My OpenAI')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
  });

  it('renders messages from browserAiChatStore, not from any Hermes chat state', () => {
    useAIStore.setState({ getActiveProvider: () => CONFIGURED_PROVIDER });
    useBrowserAiChatStore.setState({
      messages: [{ id: 'u1', role: 'user', content: 'Hello there' }],
    });

    render(<BrowserAiChat />);

    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });
});
