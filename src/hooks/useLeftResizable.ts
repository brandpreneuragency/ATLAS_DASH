import { useCallback, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useLeftResizable() {
  const setFileExplorerWidth = useUIStore((s) => s.setFileExplorerWidth);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const handleEl = e.currentTarget as HTMLElement;
      const panelEl = handleEl.previousElementSibling as HTMLElement;
      if (!panelEl) return;

      const startX = e.clientX;
      const startWidth = panelEl.getBoundingClientRect().width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - startX;
        const newWidth = Math.max(0, startWidth + delta);
        const newVw = (newWidth / window.innerWidth) * 100;
        setFileExplorerWidth(newVw);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [setFileExplorerWidth]
  );

  return { onMouseDown };
}
