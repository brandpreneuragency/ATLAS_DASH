import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import {
  ASSISTANT_MIN_PX,
  HANDLE_WIDTH_PX,
  KEYBOARD_RESIZE_STEP_LARGE_PX,
  KEYBOARD_RESIZE_STEP_PX,
  PRIMARY_MIN_PX,
  applyAssistantKeyboardDelta,
  clampAssistantWidthPx,
  pxToVw,
  vwToPx,
} from '../stores/layoutGeometry';
import { useUIStore } from '../stores/uiStore';

type ResizeKind = 'assistant' | 'context';

function setResizingState(kind: ResizeKind | null) {
  if (kind) {
    document.documentElement.dataset.resizing = kind;
  } else {
    delete document.documentElement.dataset.resizing;
  }
}

/**
 * Resize the assistant/detail wrapper. Always controls assistant width,
 * accounting for which physical side the assistant occupies.
 * Uses explicit refs — never previousElementSibling / nextElementSibling.
 *
 * Drag: update in-memory width only; persist on pointerup/cancel.
 * Keyboard: ArrowLeft/Right (Shift = larger step); persists each step.
 */
export function useAssistantResize(options: {
  shellRef: RefObject<HTMLElement | null>;
  assistantRef: RefObject<HTMLElement | null>;
  swapped: boolean;
}) {
  const { shellRef, assistantRef, swapped } = options;
  const setAssistantWrapperWidth = useUIStore((s) => s.setAssistantWrapperWidth);
  const dragging = useRef(false);
  const cleanupDrag = useRef<(() => void) | null>(null);

  const endDragSession = useCallback(() => {
    if (cleanupDrag.current) {
      cleanupDrag.current();
      cleanupDrag.current = null;
    }
  }, []);

  useEffect(() => () => endDragSession(), [endDragSession]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      const shellEl = shellRef.current;
      const assistantEl = assistantRef.current;
      const handleEl = e.currentTarget;
      if (!shellEl || !assistantEl) return;

      endDragSession();
      dragging.current = true;
      handleEl.setPointerCapture(e.pointerId);

      const assistantRect = assistantEl.getBoundingClientRect();
      const handleWidth = handleEl.getBoundingClientRect().width || HANDLE_WIDTH_PX;
      const startX = e.clientX;

      // Offset from pointer to the moving (inner) edge of the assistant.
      const pointerToMovingEdge = swapped
        ? assistantRect.right - startX
        : startX - assistantRect.left;
      const fixedEdge = swapped ? assistantRect.left : assistantRect.right;

      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      setResizingState('assistant');

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const movingEdge = swapped
          ? ev.clientX + pointerToMovingEdge
          : ev.clientX - pointerToMovingEdge;
        const newWidth = swapped
          ? movingEdge - fixedEdge
          : fixedEdge - movingEdge;

        const shellWidth = shellEl.getBoundingClientRect().width;
        const clampedPx = clampAssistantWidthPx(newWidth, shellWidth, handleWidth);
        // In-memory only during drag; persist on pointerup.
        setAssistantWrapperWidth(pxToVw(clampedPx, window.innerWidth), { persist: false });
      };

      const endDrag = (ev?: PointerEvent) => {
        if (!dragging.current && !cleanupDrag.current) return;
        dragging.current = false;
        if (ev) {
          try {
            handleEl.releasePointerCapture(ev.pointerId);
          } catch {
            // already released
          }
        }
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
        setResizingState(null);
        handleEl.removeEventListener('pointermove', onPointerMove);
        handleEl.removeEventListener('pointerup', endDrag);
        handleEl.removeEventListener('pointercancel', endDrag);
        cleanupDrag.current = null;
        // Persist final width.
        const current = useUIStore.getState().assistantWrapperWidth;
        setAssistantWrapperWidth(current, { persist: true });
      };

      cleanupDrag.current = () => endDrag();
      handleEl.addEventListener('pointermove', onPointerMove);
      handleEl.addEventListener('pointerup', endDrag);
      handleEl.addEventListener('pointercancel', endDrag);
    },
    [shellRef, assistantRef, swapped, setAssistantWrapperWidth, endDragSession],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();

      const shellEl = shellRef.current;
      if (!shellEl) return;

      const step = e.shiftKey ? KEYBOARD_RESIZE_STEP_LARGE_PX : KEYBOARD_RESIZE_STEP_PX;
      const currentVw = useUIStore.getState().assistantWrapperWidth;
      const currentPx = vwToPx(currentVw, window.innerWidth);
      const nextRaw = applyAssistantKeyboardDelta(currentPx, e.key, swapped, step);
      const handleWidth =
        e.currentTarget.getBoundingClientRect().width || HANDLE_WIDTH_PX;
      const shellWidth = shellEl.getBoundingClientRect().width;
      const clampedPx = clampAssistantWidthPx(nextRaw, shellWidth, handleWidth);
      setAssistantWrapperWidth(pxToVw(clampedPx, window.innerWidth), { persist: true });
    },
    [shellRef, swapped, setAssistantWrapperWidth],
  );

  return {
    onPointerDown,
    onKeyDown,
    ariaValueMin: ASSISTANT_MIN_PX,
    ariaValueMaxHint: PRIMARY_MIN_PX,
  };
}
