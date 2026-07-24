import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

interface AppTitlebarProps {
  children: ReactNode;
}

export function AppTitlebar({ children }: AppTitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onFsChange = () => setIsMaximized(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const stopWindowDrag = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleMinimize = () => {
    // Browser has no minimize; blur is the closest equivalent.
    window.blur();
  };

  const handleToggleMaximize = () => {
    void (async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsMaximized(false);
        } else {
          await document.documentElement.requestFullscreen();
          setIsMaximized(true);
        }
      } catch {
        // Fullscreen may be blocked by the browser.
      }
    })();
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <header ref={headerRef} className="app-titlebar">
      <div className="app-titlebar__main">
        {children}
      </div>

      <div className="app-titlebar__window-controls">
        <button
          type="button"
          className="app-titlebar__window-control"
          onMouseDown={stopWindowDrag}
          onClick={handleMinimize}
          aria-label="Minimize window"
          title="Minimize"
        >
          <Minus size={14} />
        </button>

        <button
          type="button"
          className="app-titlebar__window-control"
          onMouseDown={stopWindowDrag}
          onClick={handleToggleMaximize}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy size={13} /> : <Square size={13} />}
        </button>

        <button
          type="button"
          className="app-titlebar__window-control app-titlebar__window-control--close"
          onMouseDown={stopWindowDrag}
          onClick={handleClose}
          aria-label="Close window"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
