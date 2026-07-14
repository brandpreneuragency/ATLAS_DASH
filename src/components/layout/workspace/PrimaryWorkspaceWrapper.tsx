import { forwardRef, type ReactNode } from 'react';

interface PrimaryWorkspaceWrapperProps {
  children: ReactNode;
  /** When true, wrapper stays mounted but is removed from layout (PRD 9.2). */
  hidden?: boolean;
}

/** Top-level primary workspace wrapper (context + center). Stable across swaps. */
export const PrimaryWorkspaceWrapper = forwardRef<HTMLDivElement, PrimaryWorkspaceWrapperProps>(
  function PrimaryWorkspaceWrapper({ children, hidden = false }, ref) {
    return (
      <div
        ref={ref}
        id="primary-workspace-wrapper"
        className="primary-workspace-wrapper"
        data-wrapper="primary"
        hidden={hidden}
        aria-hidden={hidden || undefined}
      >
        {children}
      </div>
    );
  },
);
