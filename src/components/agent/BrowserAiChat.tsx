import { useBrowserAiChatStore } from '../../stores/browserAiChatStore';
import { useAIStore } from '../../stores/aiStore';
import { StandaloneAiChatPanel } from '../aiChat';

/**
 * Agent -> Browser AI. Wires the pre-existing presentational
 * `StandaloneAiChatPanel` (`src/components/aiChat/`) to `browserAiChatStore`,
 * which talks directly to the active provider from `aiStore` — never to the
 * Hermes gateway. Per the M2 map this is explicitly NOT a second Hermes chat
 * path (D-CHAT governs only `src/components/chatMode/`).
 */
export function BrowserAiChat() {
  const messages = useBrowserAiChatStore((s) => s.messages);
  const inputValue = useBrowserAiChatStore((s) => s.inputValue);
  const isSending = useBrowserAiChatStore((s) => s.isSending);
  const error = useBrowserAiChatStore((s) => s.error);
  const setInput = useBrowserAiChatStore((s) => s.setInput);
  const send = useBrowserAiChatStore((s) => s.send);
  const stop = useBrowserAiChatStore((s) => s.stop);

  const provider = useAIStore((s) => s.getActiveProvider());

  return (
    <StandaloneAiChatPanel
      title="Browser AI"
      subtitle="Direct provider chat"
      messages={messages}
      inputValue={inputValue}
      onInputChange={setInput}
      onSend={(text) => void send(text)}
      onStop={isSending ? stop : undefined}
      isSending={isSending}
      isDisabled={!provider}
      error={error}
      placeholder={provider ? 'Ask anything…' : 'Connect an AI provider in Settings to chat.'}
      modelLabel={provider?.selectedModel || undefined}
      profileLabel={provider?.name}
    />
  );
}
