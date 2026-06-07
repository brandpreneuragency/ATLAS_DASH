import { useCallback, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useResizable() {
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const handleEl = e.currentTarget as HTMLElement;
      const sidebarEl = handleEl.parentElement as HTMLElement;
      const containerEl = sidebarEl?.parentElement as HTMLElement;
      if (!sidebarEl || !containerEl) return;

      const startX = e.clientX;
      const startWidth = sidebarEl.getBoundingClientRect().width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = startX - ev.clientX;
        const newWidth = Math.max(0, startWidth + delta);
        const newVw = (newWidth / window.innerWidth) * 100;

        // Clamp so the sidebar never exceeds 40vw or pushes the center panel below 260px
        const mainColumnsWidth = containerEl.getBoundingClientRect().width;
        const maxVw = Math.min(40, ((mainColumnsWidth - 260) / window.innerWidth) * 100);
        setSidebarWidth(Math.min(newVw, Math.max(0, maxVw)));
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [setSidebarWidth]
  );

  return { onMouseDown };
}
