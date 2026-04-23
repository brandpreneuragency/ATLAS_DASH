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
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-gray-100 text-text-secondary transition-colors"
        title="More options"
      >
        <Menu size={14} />
      </button>
      {open && (
        <div className="dropdown-menu absolute left-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg z-50 py-1 w-48">
          {overflowItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-gray-50 transition-colors">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
