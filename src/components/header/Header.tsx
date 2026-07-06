import { useEffect, useRef } from 'react';
import { PanelRight } from 'lucide-react';
import { TabBar } from './TabBar';
import { selectIsRightPanelOpen, useUIStore } from '../../stores/uiStore';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function Header() {
  const rightPanelOpen = useUIStore(selectIsRightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const headerBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isTauriWindow = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauriWindow) return;

    const headerBar = headerBarRef.current;
    if (!headerBar) return;

    const appWindow = getCurrentWindow();

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const interactiveSelectors = [
        'button',
        '[role="tab"]',
        '[role="button"]',
        'a',
        'input',
        'select',
        'textarea',
        '.tab-active',
        '.tab-passive',
        '.tab',
        '.tabs-row',
        '.ai-toggle-btn',
        '#tab-plus-button',
        '#tab-plus-button-task',
      ];
      
      let element: HTMLElement | null = target;
      while (element && element !== headerBar) {
        if (interactiveSelectors.some(sel => element?.matches?.(sel))) {
          return;
        }
        element = element.parentElement;
      }

      void appWindow.startDragging();
    };

    headerBar.addEventListener('mousedown', handleMouseDown);
    return () => {
      headerBar.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return (
    <div ref={headerBarRef} id="header-bar" className="header-bar">
      <TabBar />
      <div className="ai-toggle-col">
        <button
          type="button"
          title={rightPanelOpen ? 'Hide right panel' : 'Show right panel'}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => toggleRightPanel()}
          aria-pressed={rightPanelOpen}
          className={`ai-toggle-btn${rightPanelOpen ? ' ai-toggle-btn--on' : ''}`}
        >
          <PanelRight size={16} />
        </button>
      </div>
    </div>
  );
}
