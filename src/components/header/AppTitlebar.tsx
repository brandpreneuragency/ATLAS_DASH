import { useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface AppTitlebarProps {
  children: ReactNode;
}

export function AppTitlebar({ children }: AppTitlebarProps) {
  const isTauriWindow = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriWindow) return;

    const appWindow = getCurrentWindow();
    let unlistenResize: (() => void) | null = null;

    const syncMaximized = async () => {
      try {
        setIsMaximized(await appWindow.isMaximized());
      } catch {
        // Ignore browser/runtime mismatches and keep the default icon state.
      }
    };

    void syncMaximized();
    void appWindow.onResized(() => {
      void syncMaximized();
    }).then((unlisten) => {
      unlistenResize = unlisten;
    }).catch(() => {
      unlistenResize = null;
    });

    return () => {
      unlistenResize?.();
    };
  }, [isTauriWindow]);

  const stopWindowDrag = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleMinimize = () => {
    if (!isTauriWindow) return;
    void getCurrentWindow().minimize();
  };

  const handleToggleMaximize = () => {
    if (!isTauriWindow) return;
    void (async () => {
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      setIsMaximized(await appWindow.isMaximized());
    })();
  };

  const handleClose = () => {
    if (!isTauriWindow) return;
    void getCurrentWindow().close();
  };

  return (
    <header className="app-titlebar" data-tauri-drag-region>
      <div className="app-titlebar__main">
        {children}
      </div>

      {isTauriWindow && (
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
      )}
    </header>
  );
}
