import { useCallback, useRef } from 'react';

export type ResizeDirection = 'left' | 'right';

export interface UsePanelResizeOptions {
  /**
   * The current width in vw of the panel being resized.
   */
  widthVw: number;
  /**
   * Minimum width in vw.
   */
  minWidthVw: number;
  /**
   * Maximum width in vw.
   */
  maxWidthVw: number;
  /**
   * Which side of the handle the panel sits on. For the left handle, the
   * panel is to the right of the handle (direction "right" — moving the
   * handle right widens the panel). For the right handle, the panel is to
   * the left of the handle (direction "left" — moving the handle left
   * widens the panel).
   */
  direction: ResizeDirection;
  /**
   * Called continuously during drag with the clamped new width in vw.
   */
  onResize: (widthVw: number) => void;
  /**
   * Optional minimum width constraint in vw for the opposing panel
   * (e.g. the center panel). When set, the resize will not push the
   * opposing panel below this width.
   */
  opposingMinWidthVw?: number;
}

export interface UsePanelResizeResult {
  /**
   * Pointer-down handler to attach to the resize handle element.
   */
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  /**
   * Whether a resize is currently in progress.
   */
  isDragging: boolean;
}

const VW_PER_PX = (vw: number, viewportWidth: number) => (vw / viewportWidth) * 100;

/**
 * Generic resize hook for a panel adjacent to a vertical handle.
 *
 * - Uses `pointerdown` / `pointermove` / `pointerup` for cross-input support.
 * - Clamps the new width to `[minWidthVw, maxWidthVw]`.
 * - Optionally enforces an opposing-panel minimum width.
 */
export function usePanelResize(options: UsePanelResizeOptions): UsePanelResizeResult {
  const { widthVw, minWidthVw, maxWidthVw, direction, onResize, opposingMinWidthVw } = options;
  const isDraggingRef = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Only respond to primary button (left mouse / first touch / first pen).
      if (e.button !== 0) return;
      e.preventDefault();
      const handleEl = e.currentTarget;
      // Find the panel sibling adjacent to the handle.
      const panelEl = (
        direction === 'right' ? handleEl.previousElementSibling : handleEl.nextElementSibling
      ) as HTMLElement | null;
      if (!panelEl) return;

      const startX = e.clientX;
      const startWidth = panelEl.getBoundingClientRect().width;
      const containerEl = handleEl.parentElement as HTMLElement | null;
      const containerWidth = containerEl ? containerEl.getBoundingClientRect().width : window.innerWidth;

      // Clamp the opposing panel minimum to whatever the container actually allows.
      const opposingMinPx = opposingMinWidthVw !== undefined
        ? Math.max(0, VW_PER_PX(opposingMinWidthVw, window.innerWidth) * window.innerWidth / 100)
        : undefined;
      const maxAllowedForPanelPx = opposingMinPx !== undefined
        ? Math.max(0, containerWidth - opposingMinPx)
        : undefined;

      isDraggingRef.current = true;
      // Capture the pointer so the drag continues even if the cursor leaves the handle.
      try {
        handleEl.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture can throw in older environments; ignore. */
      }

      const onPointerMove = (ev: PointerEvent) => {
        if (!isDraggingRef.current) return;
        const deltaPx = ev.clientX - startX;
        // For "right" direction the panel is on the left of the handle:
        // moving the handle right widens the panel.
        // For "left" direction the panel is on the right of the handle:
        // moving the handle left widens the panel (so we negate delta).
        const signedDelta = direction === 'right' ? deltaPx : -deltaPx;
        const candidatePx = startWidth + signedDelta;
        const candidateVw = (candidatePx / window.innerWidth) * 100;

        let clampedVw = Math.min(maxWidthVw, Math.max(minWidthVw, candidateVw));

        if (maxAllowedForPanelPx !== undefined) {
          const maxVwFromContainer = (maxAllowedForPanelPx / window.innerWidth) * 100;
          clampedVw = Math.min(clampedVw, maxVwFromContainer);
          // Re-apply min after container-clamp to avoid going below the panel's own min.
          clampedVw = Math.max(minWidthVw, clampedVw);
        }

        if (clampedVw !== widthVw) {
          onResize(clampedVw);
        }
      };

      const onPointerUp = (ev: PointerEvent) => {
        isDraggingRef.current = false;
        try {
          handleEl.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [direction, maxWidthVw, minWidthVw, onResize, opposingMinWidthVw, widthVw],
  );

  return { onPointerDown, get isDragging() { return isDraggingRef.current; } };
}
