import { useRef } from 'react';

interface HamburgerMenuProps {
  position?: 'left' | 'right';
}

export function HamburgerMenu({ }: HamburgerMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative" style={{ margin: '0 6px' }}>
      {/* Hamburger menu button removed */}
    </div>
  );
}
