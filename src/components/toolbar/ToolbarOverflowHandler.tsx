import { useState, useRef, useEffect } from 'react';

interface ToolbarOverflowHandlerProps {
  children: React.ReactNode[];
  className?: string;
}

const OVERFLOW_BTN_WIDTH = 32; // w-7 (28px) + ~4px gap

export function ToolbarOverflowHandler({ children, className = '' }: ToolbarOverflowHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(children.length);
  const [showOverflow, setShowOverflow] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !measureRef.current) return;

    const update = () => {
      const containerWidth = containerRef.current!.clientWidth;
      const measureChildren = Array.from(measureRef.current!.children) as HTMLElement[];

      let used = 0;
      let count = 0;

      for (let i = 0; i < measureChildren.length; i++) {
        const el = measureChildren[i];
        const gap = i > 0 ? 2 : 0; // gap-0.5 = 2px
        const itemWidth = el.getBoundingClientRect().width + gap;
        const hasMore = i < measureChildren.length - 1;
        // reserve space for the overflow button if there are items after this one
        const wouldNeedOverflowBtn = hasMore && used + itemWidth + OVERFLOW_BTN_WIDTH > containerWidth;

        if (used + itemWidth + (wouldNeedOverflowBtn ? OVERFLOW_BTN_WIDTH : 0) <= containerWidth) {
          used += itemWidth;
          count++;
        } else {
          break;
        }
      }

      setVisibleCount(count);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [children]);

  // Close overflow when clicking outside
  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOverflow]);

  const overflowCount = children.length - visibleCount;

  return (
    <>
      {/* Hidden measurement container — always renders all children */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className={className}
        style={{ position: 'fixed', top: -9999, left: -9999, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {children}
      </div>

      <div className={`${className} relative`} ref={containerRef}>
        {children.slice(0, visibleCount)}

        {overflowCount > 0 && (
          <button
            onClick={() => setShowOverflow((v) => !v)}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 text-text-secondary transition-colors flex-shrink-0"
            title="More options"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        )}

        {showOverflow && overflowCount > 0 && (
          <div className="dropdown-menu absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-50 py-1 w-48">
            {children.slice(visibleCount).map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition-colors">
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
