import { TabBar } from './TabBar';

export function Header() {
  return (
    <div
      id="header-bar"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        height: '36px',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      <TabBar />
    </div>
  );
}
