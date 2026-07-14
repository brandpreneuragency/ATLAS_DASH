import type { ReactNode, RefObject } from 'react';
import type { WorkspaceMode } from '../../../stores/uiLayoutState';

/** Descriptor for mode → shell slots. Resolved outside WorkspaceShell. */
export interface WorkspaceModeLayout {
  mode: WorkspaceMode;
  contextPanel: ReactNode | null;
  centerPanel: ReactNode;
  assistantPanel: ReactNode | null;
  contextPanelAvailable: boolean;
  contextPanelOpen: boolean;
  contextPanelLabel?: string;
  /** Optional leading control slot in center (inner-context toggle). */
  centerLeadingControls?: ReactNode;
  subtasksBar?: ReactNode;
  showSubtasksBar?: boolean;
}

export type WorkspaceShellLayoutKind = 'both' | 'primary-only' | 'assistant-only';

export interface WorkspaceShellRefs {
  shellRef: RefObject<HTMLDivElement | null>;
  primaryRef: RefObject<HTMLDivElement | null>;
  assistantRef: RefObject<HTMLDivElement | null>;
  contextRef: RefObject<HTMLDivElement | null>;
}
