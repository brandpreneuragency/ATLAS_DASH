import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { db } from '../services/db';

export interface TerminalEntry {
  id: string;
  name: string;
  cwd: string;
  shell: string;
}

interface TerminalStore {
  terminals: TerminalEntry[];
  activeTerminalId: string | null;
  createTerminal: (opts?: { name?: string; cwd?: string; shell?: string }) => string;
  renameTerminal: (id: string, name: string) => void;
  closeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  setCwd: (id: string, cwd: string) => void;
  loadTerminals: () => Promise<void>;
}

const STORAGE_KEY = 'terminalTabs';

function persist(terminals: TerminalEntry[], activeTerminalId: string | null) {
  void db.settings.put({ key: STORAGE_KEY, value: { terminals, activeTerminalId } });
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  terminals: [],
  activeTerminalId: null,

  createTerminal: (opts) => {
    const id = nanoid(10);
    const count = get().terminals.length + 1;
    const entry: TerminalEntry = {
      id,
      name: opts?.name ?? `Terminal ${count}`,
      cwd: opts?.cwd ?? '',
      shell: opts?.shell ?? '',
    };
    set((s) => {
      const terminals = [...s.terminals, entry];
      const next = { terminals, activeTerminalId: id };
      persist(terminals, id);
      return next;
    });
    return id;
  },

  renameTerminal: (id, name) => {
    set((s) => {
      const terminals = s.terminals.map((t) => (t.id === id ? { ...t, name } : t));
      persist(terminals, s.activeTerminalId);
      return { terminals };
    });
  },

  closeTerminal: (id) => {
    set((s) => {
      const terminals = s.terminals.filter((t) => t.id !== id);
      const activeTerminalId =
        s.activeTerminalId === id ? terminals[terminals.length - 1]?.id ?? null : s.activeTerminalId;
      persist(terminals, activeTerminalId);
      return { terminals, activeTerminalId };
    });
  },

  setActiveTerminal: (id) => {
    set((s) => {
      persist(s.terminals, id);
      return { activeTerminalId: id };
    });
  },

  setCwd: (id, cwd) => {
    set((s) => {
      const terminals = s.terminals.map((t) => (t.id === id ? { ...t, cwd } : t));
      persist(terminals, s.activeTerminalId);
      return { terminals };
    });
  },

  loadTerminals: async () => {
    const row = await db.settings.get(STORAGE_KEY);
    if (row && row.value && typeof row.value === 'object') {
      const value = row.value as { terminals?: TerminalEntry[]; activeTerminalId?: string | null };
      set({
        terminals: value.terminals ?? [],
        activeTerminalId: value.activeTerminalId ?? null,
      });
    }
  },
}));
