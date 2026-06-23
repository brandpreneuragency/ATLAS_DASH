import type { ReactNode } from 'react';

export type AiChatPanelMessageRole = 'user' | 'assistant' | 'system';

export type AiChatPanelMessage = {
  id: string;
  role: AiChatPanelMessageRole;
  content: string;
  createdAt?: string | Date;
  isPending?: boolean;
  error?: string;
};

export type StandaloneAiChatPanelProps = {
  title: string;
  subtitle?: string;
  messages: AiChatPanelMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (message: string) => void | Promise<void>;
  onStop?: () => void;
  isSending?: boolean;
  isDisabled?: boolean;
  error?: string | null;
  placeholder?: string;
  modelLabel?: string;
  profileLabel?: string;
  headerActions?: ReactNode;
  className?: string;
};
