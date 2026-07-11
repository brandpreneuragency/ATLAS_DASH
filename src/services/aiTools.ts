// AI tool surface (Claude Code-parity) exposed to the AI sidebar.
//
// Defines the OpenAI-compatible `tools` schema and a dispatcher that invokes
// the Rust `ai_*` Tauri commands. The dispatcher supports two permission
// modes:
//   - 'ask'    : each call is gated behind a user approval promise (the UI
//                renders a pending tool-call bubble and resolves on Approve/
//                Reject).
//   - 'bypass' : calls execute immediately.
//
// The workspace root is taken from the active connected folder. If no folder
// is connected, the dispatcher returns an error result (the chat surfaces it).

import { invoke } from '@tauri-apps/api/core';
import type { OpenAITool, ToolCall } from './ai/types';
import type { ToolResult } from '../hooks/useAgentLoop';
import type { AgentPermissionMode } from '../hooks/useAgentLoop';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { isTauriRuntime } from './runtime';
import { readDir, readTextFile, writeTextFile } from './fs-adapter';

/** Resolve the active workspace root path, or null if none connected. */
export function getWorkspaceRoot(): string | null {
  // In the new workspace model, folders are per-workspace.
  const wsStore = useWorkspaceStore.getState();
  const ws = wsStore.getActiveWorkspace();
  if (ws) {
    const folders = wsStore.getActiveConnectedFolders();
    const folder = folders.find((f) => f.id === ws.activeFolderId) ?? folders[0];
    return folder?.path ?? null;
  }
  // Fallback to legacy fileSystemStore (for any remaining references)
  const { connectedFolders, activeFolderId } = useFileSystemStore.getState();
  const folder =
    connectedFolders.find((f) => f.id === activeFolderId) ??
    connectedFolders[0];
  return folder?.path ?? null;
}

/** OpenAI-compatible tool schema for all six AI tools. */
export const AI_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'shell_exec',
      description:
        'Run a shell command in the workspace (cmd.exe /C on Windows). Returns stdout, stderr, exit code and whether it timed out. Use for build, test, git, and other CLI tasks.',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: 'The shell command to execute.' },
          timeout_ms: {
            type: 'number',
            description: 'Optional timeout in milliseconds (default 60000).',
          },
        },
        required: ['cmd'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_read',
      description:
        'Read a file in the workspace with cat -n style line numbers. Optionally slice by 1-based offset/limit.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
          offset: { type: 'number', description: '1-based starting line.' },
          limit: { type: 'number', description: 'Maximum number of lines to return.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_write',
      description:
        'Write content to a file in the workspace, creating parent directories. Overwrites existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
          content: { type: 'string', description: 'Full file content to write.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'file_edit',
      description:
        'Replace occurrences of `old` with `new` in a workspace file. Errors if `old` is not unique and replace_all is false.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
          old: { type: 'string', description: 'Text to find.' },
          new: { type: 'string', description: 'Replacement text.' },
          replace_all: {
            type: 'boolean',
            description: 'Replace all occurrences (default false).',
          },
        },
        required: ['path', 'old', 'new'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files by glob pattern (e.g. "**/*.ts") within the workspace.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern.' },
          path: { type: 'string', description: 'Optional sub-path to search within.' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description:
        'Search file contents by regex within the workspace. Returns matching lines with numbers.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regular expression to search for.' },
          path: { type: 'string', description: 'Optional sub-path to search within.' },
          glob: { type: 'string', description: 'Optional glob to filter files.' },
          case_insensitive: { type: 'boolean', description: 'Case-insensitive match.' },
        },
        required: ['pattern'],
      },
    },
  },
];

/** A gate the UI uses to pause execution until the user approves/rejects. */
export interface ApprovalGate {
  /** Resolve with true to approve, false to reject. */
  resolve: (approved: boolean) => void;
  promise: Promise<boolean>;
}

/** Create a pending approval gate (used by the Ask & Approve UI). */
export function createApprovalGate(): ApprovalGate {
  let resolve!: (approved: boolean) => void;
  const promise = new Promise<boolean>((res) => {
    resolve = res;
  });
  return { resolve, promise };
}

/** Module-level registry of pending approval gates, keyed by tool call id.
 *  The UI resolves these when the user clicks Approve/Reject. */
const pendingApprovals = new Map<string, ApprovalGate>();

/** Register a gate so the UI can resolve it by tool call id. */
export function registerApproval(toolCallId: string, gate: ApprovalGate): void {
  pendingApprovals.set(toolCallId, gate);
}

/** Resolve a pending approval (called by the tool-call bubble buttons). */
export function resolveApproval(toolCallId: string, approved: boolean): void {
  const gate = pendingApprovals.get(toolCallId);
  if (gate) {
    gate.resolve(approved);
    pendingApprovals.delete(toolCallId);
  }
}

function summarizeResult(name: string, raw: unknown): string {
  try {
    const r = raw as Record<string, unknown>;
    if (name === 'shell_exec') {
      const stdout = String(r.stdout ?? '');
      const lines = stdout.split('\n').slice(0, 3).join('\n');
      return `exit ${r.exit_code ?? '?'}${r.timed_out ? ' (timed out)' : ''}${lines ? `\n${lines}` : ''}`;
    }
    if (name === 'glob' || name === 'grep') {
      const arr = Array.isArray(r) ? r : [];
      return `${arr.length} match${arr.length === 1 ? '' : 'es'}`;
    }
    if (name === 'file_read') {
      return `${r.line_count ?? '?'} lines`;
    }
    if (name === 'file_write') {
      return `${r.bytes_written ?? '?'} bytes written`;
    }
    if (name === 'file_edit') {
      return `${r.replacements ?? '?'} replacement(s)`;
    }
  } catch {
    /* ignore */
  }
  return 'done';
}

export interface DispatchCallbacks {
  /** Render a pending tool-call bubble (ask mode). Should register the gate
   *  via `registerApproval` and return when the user decides. */
  addPendingBubble?: (call: ToolCall) => Promise<boolean>;
  /** Render a completed tool-call bubble (bypass mode, or after approval). */
  addCompletedBubble?: (call: ToolCall) => void;
  /** Update an already-rendered bubble to its final state (done/rejected). */
  updateBubble?: (
    toolCallId: string,
    status: 'done' | 'rejected',
    summary?: string,
  ) => void;
}

/**
 * Dispatch a single tool call. In 'ask' mode `addPendingBubble` renders a
 * pending bubble and resolves to the user's decision (the UI resolves the
 * registered approval gate on Approve/Reject). In 'bypass' mode the call
 * executes immediately.
 */
export async function dispatchToolCall(
  call: ToolCall,
  mode: AgentPermissionMode,
  callbacks: DispatchCallbacks = {},
): Promise<ToolResult> {
  const root = getWorkspaceRoot();
  if (!root) {
    return {
      toolCallId: call.id,
      content: 'No workspace folder is connected. Connect a folder to use AI tools.',
      isError: true,
    };
  }

  if (mode === 'ask') {
    if (!callbacks.addPendingBubble) {
      return { toolCallId: call.id, content: 'Approval handler missing.', isError: true };
    }
    const ok = await callbacks.addPendingBubble(call);
    if (!ok) {
      callbacks.updateBubble?.(call.id, 'rejected');
      return {
        toolCallId: call.id,
        content: 'user_rejected',
        isError: true,
      };
    }
  } else {
    // Bypass mode: render a completed card up front.
    callbacks.addCompletedBubble?.(call);
  }

  try {
    const result = await executeTool(call, root);
    const summary = summarizeResult(call.name, result);
    callbacks.updateBubble?.(call.id, 'done', summary);
    return {
      toolCallId: call.id,
      content: typeof result === 'string' ? result : JSON.stringify(result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { toolCallId: call.id, content: `error: ${message}`, isError: true };
  }
}

/** Invoke the matching Rust command (Tauri) or browser FS backend. */
async function executeTool(call: ToolCall, root: string): Promise<unknown> {
  if (!isTauriRuntime()) {
    return executeToolInBrowser(call, root);
  }

  const a = call.args as Record<string, unknown>;
  switch (call.name) {
    case 'shell_exec':
      return invoke('ai_shell_exec', {
        workspaceRoot: root,
        cmd: a.cmd,
        timeoutMs: a.timeout_ms,
      });
    case 'file_read':
      return invoke('ai_file_read', {
        workspaceRoot: root,
        path: a.path,
        offset: a.offset,
        limit: a.limit,
      });
    case 'file_write':
      return invoke('ai_file_write', {
        workspaceRoot: root,
        path: a.path,
        content: a.content,
      });
    case 'file_edit':
      return invoke('ai_file_edit', {
        workspaceRoot: root,
        path: a.path,
        old: a.old,
        new: a.new,
        replaceAll: a.replace_all,
      });
    case 'glob':
      return invoke('ai_glob', {
        workspaceRoot: root,
        pattern: a.pattern,
        path: a.path,
      });
    case 'grep':
      return invoke('ai_grep', {
        workspaceRoot: root,
        pattern: a.pattern,
        path: a.path,
        glob: a.glob,
        caseInsensitive: a.case_insensitive,
      });
    default:
      throw new Error(`unknown tool: ${call.name}`);
  }
}

function resolveWorkspacePath(root: string, rel: string): string {
  const cleaned = String(rel ?? '').replace(/^[/\\]+/, '').replace(/\\/g, '/');
  if (!cleaned || cleaned === '.') return root.replace(/\\/g, '/');
  return `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/${cleaned}`;
}

function matchGlob(name: string, pattern: string): boolean {
  // Minimal glob: * and ? only, matched against the full relative path.
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(name.replace(/\\/g, '/'));
}

async function walkFiles(
  dir: string,
  root: string,
  out: string[],
  max = 500,
): Promise<void> {
  if (out.length >= max) return;
  const entries = await readDir(dir);
  for (const entry of entries) {
    if (out.length >= max) return;
    const rel = entry.path.replace(/\\/g, '/').slice(root.replace(/\\/g, '/').length).replace(/^\//, '');
    if (entry.kind === 'directory') {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
      await walkFiles(entry.path, root, out, max);
    } else {
      out.push(rel);
    }
  }
}

async function executeToolInBrowser(call: ToolCall, root: string): Promise<unknown> {
  const a = call.args as Record<string, unknown>;
  switch (call.name) {
    case 'shell_exec':
      throw new Error('shell_exec requires the TABS desktop app.');
    case 'file_read': {
      const full = resolveWorkspacePath(root, String(a.path ?? ''));
      const text = await readTextFile(full);
      const lines = text.split('\n');
      const offset = Math.max(1, Number(a.offset ?? 1));
      const limit = a.limit != null ? Math.max(0, Number(a.limit)) : lines.length;
      const slice = lines.slice(offset - 1, offset - 1 + limit);
      const numbered = slice
        .map((line, i) => `${String(offset + i).padStart(6, ' ')}|${line}`)
        .join('\n');
      return { content: numbered, line_count: slice.length };
    }
    case 'file_write': {
      const full = resolveWorkspacePath(root, String(a.path ?? ''));
      const content = String(a.content ?? '');
      await writeTextFile(full, content);
      return { bytes_written: new TextEncoder().encode(content).length };
    }
    case 'file_edit': {
      const full = resolveWorkspacePath(root, String(a.path ?? ''));
      const oldStr = String(a.old ?? '');
      const newStr = String(a.new ?? '');
      const replaceAll = Boolean(a.replace_all);
      const text = await readTextFile(full);
      if (!text.includes(oldStr)) {
        throw new Error('old string not found in file');
      }
      const next = replaceAll
        ? text.split(oldStr).join(newStr)
        : text.replace(oldStr, newStr);
      const replacements = replaceAll
        ? text.split(oldStr).length - 1
        : 1;
      await writeTextFile(full, next);
      return { replacements };
    }
    case 'glob': {
      const pattern = String(a.pattern ?? '**/*');
      const base = a.path ? resolveWorkspacePath(root, String(a.path)) : root;
      const files: string[] = [];
      await walkFiles(base, root, files);
      return files.filter((f) => matchGlob(f, pattern) || matchGlob(f.split('/').pop() ?? f, pattern));
    }
    case 'grep': {
      const pattern = String(a.pattern ?? '');
      const flags = a.case_insensitive ? 'i' : '';
      const re = new RegExp(pattern, flags);
      const base = a.path ? resolveWorkspacePath(root, String(a.path)) : root;
      const globFilter = a.glob ? String(a.glob) : null;
      const files: string[] = [];
      await walkFiles(base, root, files);
      const matches: Array<{ path: string; line: number; text: string }> = [];
      for (const rel of files) {
        if (globFilter && !matchGlob(rel, globFilter) && !matchGlob(rel.split('/').pop() ?? rel, globFilter)) {
          continue;
        }
        try {
          const text = await readTextFile(resolveWorkspacePath(root, rel));
          const lines = text.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i])) {
              matches.push({ path: rel, line: i + 1, text: lines[i] });
              if (matches.length >= 200) return matches;
            }
          }
        } catch {
          /* skip unreadable */
        }
      }
      return matches;
    }
    default:
      throw new Error(`unknown tool: ${call.name}`);
  }
}

export { summarizeResult };
