import { useCallback, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useResizable() {
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const vw = window.innerWidth;
        const sidebarWidth = ((vw - ev.clientX) / vw) * 100;
        setSidebarWidth(sidebarWidth);
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
