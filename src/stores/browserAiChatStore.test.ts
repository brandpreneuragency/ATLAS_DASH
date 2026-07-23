import { describe, it, expect, vi, beforeEach } from 'vitest';

const getActiveProviderMock = vi.fn();
vi.mock('./aiStore', () => ({
  useAIStore: {
    getState: () => ({ getActiveProvider: getActiveProviderMock }),
  },
}));

const streamChatMock = vi.fn();
vi.mock('../services/ai/router', () => ({
  streamChat: (...args: unknown[]) => streamChatMock(...args),
}));

const secureGetMock = vi.fn();
vi.mock('../services/secureStorage', () => ({
  secureStorage: { secureGet: (...args: unknown[]) => secureGetMock(...args) },
}));

import { useBrowserAiChatStore } from './browserAiChatStore';

const PROVIDER = {
  id: 'p1',
  name: 'Test Provider',
  provider: 'openai-compatible',
  apiKey: 'sk-test',
  selectedModel: 'gpt-4o',
  isActive: true,
  baseUrl: 'https://api.example.com/v1',
  customModels: [],
};

async function* fakeStream(chunks: string[]) {
  for (const c of chunks) {
    yield { content: c };
  }
}

describe('browserAiChatStore (Agent -> Browser AI, direct-provider chat)', () => {
  beforeEach(() => {
    useBrowserAiChatStore.setState({
      messages: [],
      inputValue: '',
      isSending: false,
      error: null,
    });
    getActiveProviderMock.mockReset();
    streamChatMock.mockReset();
    secureGetMock.mockReset();
  });

  it('send() with no configured provider sets an error and never calls streamChat', async () => {
    getActiveProviderMock.mockReturnValue(null);

    await useBrowserAiChatStore.getState().send('hello');

    expect(streamChatMock).not.toHaveBeenCalled();
    expect(useBrowserAiChatStore.getState().error).toMatch(/No AI provider configured/);
    expect(useBrowserAiChatStore.getState().messages).toEqual([]);
  });

  it('send() streams a response through the active provider via services/ai/router::streamChat, never Hermes', async () => {
    getActiveProviderMock.mockReturnValue(PROVIDER);
    streamChatMock.mockReturnValue(fakeStream(['Hel', 'lo!']));

    await useBrowserAiChatStore.getState().send('hi there');

    expect(streamChatMock).toHaveBeenCalledTimes(1);
    const [history, resolvedProvider] = streamChatMock.mock.calls[0];
    expect(history).toEqual([{ role: 'user', content: 'hi there' }]);
    expect(resolvedProvider).toMatchObject({ id: 'p1', apiKey: 'sk-test' });

    const { messages, isSending, error } = useBrowserAiChatStore.getState();
    expect(isSending).toBe(false);
    expect(error).toBeNull();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'hi there' });
    expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Hello!', isPending: false });
  });

  it('send() surfaces a provider error on the assistant bubble and the store error field', async () => {
    getActiveProviderMock.mockReturnValue(PROVIDER);
    streamChatMock.mockImplementation(async function* () {
      yield* []; // satisfy require-yield; the generator still throws before producing a value.
      throw new Error('upstream 500');
    });

    await useBrowserAiChatStore.getState().send('will fail');

    const { messages, error, isSending } = useBrowserAiChatStore.getState();
    expect(isSending).toBe(false);
    expect(error).toBe('upstream 500');
    expect(messages[1]).toMatchObject({ role: 'assistant', isPending: false, error: 'upstream 500' });
  });

  it('falls back to secureStorage when the provider config carries no apiKey', async () => {
    getActiveProviderMock.mockReturnValue({ ...PROVIDER, apiKey: '' });
    secureGetMock.mockResolvedValue('sk-from-secure-storage');
    streamChatMock.mockReturnValue(fakeStream(['ok']));

    await useBrowserAiChatStore.getState().send('hi');

    expect(secureGetMock).toHaveBeenCalledWith('providerApiKey_p1');
    const [, resolvedProvider] = streamChatMock.mock.calls[0];
    expect(resolvedProvider).toMatchObject({ apiKey: 'sk-from-secure-storage' });
  });
});
