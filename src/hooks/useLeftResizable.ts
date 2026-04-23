import { useCallback, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

export function useLeftResizable() {
  const setFileExplorerWidth = useUIStore((s) => s.setFileExplorerWidth);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const vw = window.innerWidth;
        const width = (ev.clientX / vw) * 100;
        setFileExplorerWidth(width);
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
