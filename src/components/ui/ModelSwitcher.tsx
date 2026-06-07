import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useAIStore } from '../../stores/aiStore';

export function ModelSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { providerConfigs, activeProviderId, setActiveProvider } = useAIStore();

  const filtered = providerConfigs.filter((cfg) => {
    const label = cfg.name.toLowerCase();
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
    <div id="model-switcher-overlay" className="overlay" style={{ zIndex: 200 }}>
      <div id="model-switcher-panel" className="switcher-panel">
        <div id="model-switcher-search-row" className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border-1)', gap: 8 }}>
          <Search size={14} className="tt-primary shrink-0" />
          <input
            id="model-switcher-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search models…"
            className="flex-1"
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-1)', background: 'transparent', outline: 'none', border: 'none' }}
          />
          <kbd style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)', border: '1px solid var(--c-border-1)', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>
            Esc
          </kbd>
        </div>

        <div id="model-switcher-list" ref={listRef} className="overflow-y-a flex-1" style={{ maxHeight: 256 }}>
          {filtered.length === 0 ? (
            <p className="label" style={{ padding: '24px 16px', textAlign: 'center' }}>
              {providerConfigs.length === 0
                ? 'No models configured — add one in Settings'
                : `No models match "${query}"`}
            </p>
          ) : (
            filtered.map((cfg, i) => {
              const providerLabel = cfg.name;
              const isActive = cfg.id === activeProviderId;
              return (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={() => select(cfg.id)}
                  className="row full"
                  style={{
                    padding: '10px 16px',
                    textAlign: 'left',
                    background: i === activeIndex ? 'var(--c-background-4)' : 'transparent',
                    transition: 'background-color 0.15s',
                    cursor: 'pointer',
                    border: 'none',
                    color: 'var(--c-text-1)',
                    fontSize: 'var(--fs-xs)',
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: isActive ? 'var(--c-accent-center-panel)' : 'var(--c-border-1)',
                    }}
                  />
                  <span className="label trunc shrink-0" style={{ width: 96 }}>
                    {providerLabel}
                  </span>
                  <span className="med trunc flex-1" style={{ fontSize: 'var(--fs-xs)' }}>
                    {cfg.selectedModel}
                  </span>
                  {isActive && (
                    <span className="bold shrink-0" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-accent-center-panel)', marginLeft: 'auto' }}>
                      active
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="row" style={{ padding: '8px 16px', borderTop: '1px solid var(--c-border-1)', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--c-text-2)' }}>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Ctrl+M toggle</span>
        </div>
      </div>
    </div>
  );
}
