import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';
import { PROVIDER_MODELS } from '../../services/ai/router';

export function ModelSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { providerConfigs, activeProviderId, setActiveProvider } = useAIStore();

  const filtered = providerConfigs.filter((cfg) => {
    const label = (PROVIDER_MODELS[cfg.provider]?.label ?? cfg.provider).toLowerCase();
    const model = cfg.selectedModel.toLowerCase();
    const q = query.toLowerCase();
    return label.includes(q) || model.includes(q);
  });

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const select = useCallback((id: string) => {
    setActiveProvider(id);
    close();
  }, [setActiveProvider, close]);

  // Global Ctrl+M / Cmd+M toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened, reset index when query changes
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Keyboard navigation inside the panel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      select(filtered[activeIndex].id);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="relative w-96 bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

        {/* Search row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={14} className="text-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search models…"
            className="flex-1 text-sm text-text-primary placeholder-text-secondary bg-transparent outline-none"
          />
          <kbd className="text-[10px] text-text-secondary border border-border rounded px-1 py-0.5 flex-shrink-0">
            Esc
          </kbd>
        </div>

        {/* Model list */}
        <div ref={listRef} className="overflow-y-auto max-h-64 py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-xs text-text-secondary text-center">
              {providerConfigs.length === 0
                ? 'No models configured — add one in Settings'
                : `No models match "${query}"`}
            </p>
          ) : (
            filtered.map((cfg, i) => {
              const providerLabel = PROVIDER_MODELS[cfg.provider]?.label ?? cfg.provider;
              const isActive = cfg.id === activeProviderId;
              return (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => select(cfg.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIndex ? 'bg-highlight' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isActive ? 'bg-brand' : 'bg-border'
                  }`} />
                  <span className="text-[11px] text-text-secondary w-24 flex-shrink-0 truncate">
                    {providerLabel}
                  </span>
                  <span className="text-xs text-text-primary font-medium truncate flex-1">
                    {cfg.selectedModel}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-brand font-semibold flex-shrink-0">
                      active
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-border flex justify-between text-[10px] text-text-secondary">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Ctrl+M toggle</span>
        </div>
      </div>
    </div>
  );
}
