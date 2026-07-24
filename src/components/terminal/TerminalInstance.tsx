import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useThemeStore } from '../../stores/themeStore';
import {
  connectVpsTerminal,
  type VpsTerminalSession,
} from '../../services/vpsTerminal';

interface TerminalInstanceProps {
  id: string;
  active: boolean;
  onExit?: (id: string) => void;
}

function buildTheme() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    background: get('--c-background-1', '#1e1e1e'),
    foreground: get('--c-text-1', '#d4d4d4'),
    cursor: get('--c-accent-center-panel', '#ffffff'),
    selectionBackground: get('--c-accent-center-panel', '#ffffff'),
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  };
}

export function TerminalInstance({ id, active, onExit }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<VpsTerminalSession | null>(null);
  const themeVersion = useThemeStore((s) => s.tokens);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      fontFamily: 'Consolas, "Cascadia Code", Menlo, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: buildTheme(),
      convertEol: true,
      disableStdin: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try {
      fit.fit();
    } catch {
      /* ignore */
    }
    termRef.current = term;
    fitRef.current = fit;

    let disposed = false;
    const session = connectVpsTerminal({
      id,
      cols: term.cols,
      rows: term.rows,
      onData: (text) => {
        if (!disposed) term.write(text);
      },
      onOpen: () => {
        if (disposed) return;
        term.options.disableStdin = false;
        term.write('\x1b[90mConnected to VPS shell.\x1b[0m\r\n');
        try {
          fit.fit();
          session.resize(term.cols, term.rows);
        } catch {
          /* ignore */
        }
      },
      onClose: (reason) => {
        if (disposed) return;
        term.options.disableStdin = true;
        const msg = reason ? ` (${reason})` : '';
        term.write(`\r\n\x1b[90m[disconnected${msg}]\x1b[0m\r\n`);
        onExit?.(id);
      },
      onError: (message) => {
        if (disposed) return;
        term.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
      },
    });
    sessionRef.current = session;

    term.onData((data) => {
      session.write(data);
    });

    const onResize = () => {
      try {
        fit.fit();
        session.resize(term.cols, term.rows);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      session.close();
      sessionRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (active && termRef.current && fitRef.current) {
      requestAnimationFrame(() => {
        const term = termRef.current;
        const fit = fitRef.current;
        if (!term || !fit) return;
        try {
          fit.fit();
          sessionRef.current?.resize(term.cols, term.rows);
        } catch {
          /* ignore */
        }
      });
    }
  }, [active, id]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = buildTheme();
    }
  }, [themeVersion]);

  return (
    <div
      ref={containerRef}
      className={`terminal-instance${active ? '' : ' terminal-instance--hidden'}`}
    />
  );
}
