import { HamburgerMenu } from './HamburgerMenu';
import { TabBar } from './TabBar';

export function Header() {
  return (
    <div className="flex items-center h-[50px] px-2.5 py-0 gap-2 bg-[rgba(240,240,240,1)] mt-0 mb-0">
      <HamburgerMenu />
      <div className="flex-1 flex items-end overflow-hidden min-w-0 self-stretch">
        <TabBar />
      </div>
    </div>
  );
}
