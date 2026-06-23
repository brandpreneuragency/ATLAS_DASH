import { useCallback, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

const RIGHT_PANEL_MIN_WIDTH = 320;
// No hard max — the center panel's 260px minimum is the only constraint.
// The grid track (auto) in #main-row will give the panel as much space
// as the center panel is willing to give up.
const RIGHT_PANEL_MAX_WIDTH = Number.POSITIVE_INFINITY;
const CENTER_PANEL_MIN_WIDTH = 260;

export function useResizable() {
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const panelsSwapped = useUIStore((s) => s.panelsSwapped);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const handleEl = e.currentTarget as HTMLElement;
      const rowEl = handleEl.closest('#main-row') as HTMLElement | null;
      if (!rowEl) return;

      const sidebarEl = (panelsSwapped
        ? handleEl.previousElementSibling
        : handleEl.nextElementSibling) as HTMLElement | null;
      if (!sidebarEl) return;

      const sidebarRect = sidebarEl.getBoundingClientRect();
      const handleWidth = handleEl.getBoundingClientRect().width;
      const startX = e.clientX;

      // Preserve the cursor offset inside the handle so the first move does
      // not snap the sidebar to its minimum width.
      const pointerToMovingEdge = panelsSwapped
        ? sidebarRect.right - startX
        : startX - sidebarRect.left;
      const fixedEdge = panelsSwapped ? sidebarRect.left : sidebarRect.right;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;

        const movingEdge = panelsSwapped
          ? ev.clientX + pointerToMovingEdge
          : ev.clientX - pointerToMovingEdge;
        const newWidth = panelsSwapped
          ? movingEdge - fixedEdge
          : fixedEdge - movingEdge;

        const rowWidth = rowEl.getBoundingClientRect().width;
        const maxWidth = Math.min(
          RIGHT_PANEL_MAX_WIDTH,
          Math.max(RIGHT_PANEL_MIN_WIDTH, rowWidth - CENTER_PANEL_MIN_WIDTH - handleWidth)
        );
        const clampedWidth = Math.min(Math.max(newWidth, RIGHT_PANEL_MIN_WIDTH), maxWidth);
        setSidebarWidth((clampedWidth / window.innerWidth) * 100);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [setSidebarWidth, panelsSwapped]
  );

  return { onMouseDown };
}
