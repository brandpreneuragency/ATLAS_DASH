import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Menu } from 'lucide-react';

interface ToolbarOverflowMenuProps {
  overflowItems: ReactElement[];
  onClose: () => void;
}

export function ToolbarOverflowMenu({ overflowItems, onClose }: ToolbarOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        id="toolbar-overflow-menu-btn"
        onClick={() => setOpen(!open)}
        className="tbar-btn"
        title="More options"
      >
        <Menu size={14} />
      </button>
      {open && (
        <div id="toolbar-overflow-menu-drop" className="drop" style={{ left: 0, width: 192 }}>
          {overflowItems.map((item, idx) => (
            <div key={idx} className="drop-item">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
