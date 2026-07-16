/**
 * Hermes dashboard REST + gateway event types.
 * Field names and event type strings are copied from the Hermes desktop
 * reference (read-only):
 * - apps/desktop/src/types/hermes.ts (SessionInfo, SessionMessage, RpcEvent)
 * - apps/shared/src/json-rpc-gateway.ts (GatewayEvent / GatewayEventName)
 * - apps/desktop/src/app/session/hooks/use-message-stream/gateway-event.ts
 */

/** Session row from GET /api/sessions (SessionInfo in desktop types). */
export interface HermesSession {
  id: string;
  title: null | string;
  preview: null | string;
  model: null | string;
  source: null | string;
  started_at: number;
  last_active: number;
  ended_at: null | number;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
  tool_call_count: number;
  is_active: boolean;
  archived?: boolean;
  cwd?: null | string;
  git_branch?: null | string;
  git_repo_root?: null | string;
  parent_session_id?: null | string;
  _lineage_root_id?: null | string;
  profile?: null | string;
  handoff_platform?: null | string;
  handoff_state?: null | string;
  handoff_error?: null | string;
}

/** Transcript message from GET /api/sessions/{id}/messages. */
export interface HermesMessage {
  role: 'assistant' | 'system' | 'tool' | 'user';
  content: unknown;
  text?: unknown;
  timestamp?: number;
  name?: string;
  reasoning?: null | string;
  reasoning_content?: null | string;
  reasoning_details?: unknown;
  tool_call_id?: null | string;
  tool_calls?: unknown;
  tool_name?: string;
  codex_reasoning_items?: unknown;
  context?: unknown;
}

/** Envelope for GET /api/sessions. */
export interface HermesSessionsResponse {
  sessions: HermesSession[];
  total: number;
  limit: number;
  offset: number;
  profile_totals?: Record<string, number>;
  errors?: Array<{ profile: string; error: string }>;
}

/** Envelope for GET /api/sessions/{id}/messages. */
export interface HermesMessagesResponse {
  messages: HermesMessage[];
  session_id: string;
}

/** Shared payload fields used across many gateway events. */
export interface HermesGatewayEventPayload {
  text?: string;
  rendered?: string;
  message?: string;
  command?: string;
  description?: string;
  allow_permanent?: boolean;
  smart_denied?: boolean;
  choices?: string[];
  request_id?: string;
  question?: string;
  env_var?: string;
  prompt?: string;
  name?: string;
  tool_id?: string;
  inline_diff?: string;
  kind?: string;
  model?: string;
  provider?: string;
  running?: boolean;
  cwd?: string;
  branch?: string;
  approval_mode?: string;
  title?: string;
  session_id?: string;
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Base gateway event (RpcEvent / GatewayEvent in the desktop client).
 * Wire form on /api/ws is JSON-RPC: { method: "event", params: HermesGatewayEvent }.
 * Wire form on /api/events is the bare event object.
 */
export interface HermesGatewayEventBase {
  type: string;
  session_id?: string;
  profile?: string;
  payload?: HermesGatewayEventPayload;
}

export interface HermesMessageDeltaEvent extends HermesGatewayEventBase {
  type: 'message.delta';
  payload?: HermesGatewayEventPayload & { text?: string };
}

export interface HermesMessageCompleteEvent extends HermesGatewayEventBase {
  type: 'message.complete';
  payload?: HermesGatewayEventPayload & { text?: string; rendered?: string };
}

export interface HermesMessageStartEvent extends HermesGatewayEventBase {
  type: 'message.start';
}

export interface HermesErrorEvent extends HermesGatewayEventBase {
  type: 'error';
  payload?: HermesGatewayEventPayload & { message?: string };
}

/** Dangerous-command / execute_code approval (gateway-event.ts). */
export interface HermesApprovalRequestEvent extends HermesGatewayEventBase {
  type: 'approval.request';
  payload?: HermesGatewayEventPayload & {
    command?: string;
    description?: string;
    allow_permanent?: boolean;
    smart_denied?: boolean;
    choices?: string[];
  };
}

export interface HermesClarifyRequestEvent extends HermesGatewayEventBase {
  type: 'clarify.request';
  payload?: HermesGatewayEventPayload & {
    request_id?: string;
    question?: string;
    choices?: string[];
  };
}

export interface HermesToolEvent extends HermesGatewayEventBase {
  type: 'tool.start' | 'tool.progress' | 'tool.generating' | 'tool.complete';
}

export interface HermesSessionInfoEvent extends HermesGatewayEventBase {
  type: 'session.info';
}

export interface HermesThinkingDeltaEvent extends HermesGatewayEventBase {
  type: 'thinking.delta' | 'reasoning.delta' | 'reasoning.available';
}

export type HermesGatewayEvent =
  | HermesMessageDeltaEvent
  | HermesMessageCompleteEvent
  | HermesMessageStartEvent
  | HermesErrorEvent
  | HermesApprovalRequestEvent
  | HermesClarifyRequestEvent
  | HermesToolEvent
  | HermesSessionInfoEvent
  | HermesThinkingDeltaEvent
  | HermesGatewayEventBase;

/**
 * Outbound chat prompt — desktop uses JSON-RPC on /api/ws:
 * `{ jsonrpc: "2.0", id, method: "prompt.submit", params: { session_id, text } }`
 * (see apps/shared/src/json-rpc-gateway.ts + use-prompt-actions/submit.ts).
 */
export interface HermesPromptSubmitParams {
  session_id?: string | null;
  text: string;
}

/**
 * Dangerous-command approval response — desktop sends JSON-RPC on /api/ws:
 * `{ method: "approval.respond", params: { choice, session_id } }`
 * (apps/desktop approval.tsx + store/prompts.ts).
 *
 * Choices used by TABS inbox:
 * - `once`  → Approve (run once)
 * - `deny`  → Deny
 * Desktop also supports `session` / `always` (not exposed in the simple inbox).
 *
 * Approvals are session-keyed (one in-flight per session); there is no request_id.
 */
export type HermesApprovalChoice = 'once' | 'deny' | 'session' | 'always';

export interface HermesApprovalRespondParams {
  choice: HermesApprovalChoice;
  session_id?: string | null;
}
