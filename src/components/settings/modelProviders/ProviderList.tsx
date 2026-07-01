import type { ReactNode } from 'react';

interface ProviderListItemProps {
  id: string;
  label: string;
  connected: boolean;
  meta?: number;
  active: boolean;
  onClick: () => void;
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className="settings-list-item-meta"
      style={{
        width: 8,
        height: 8,
        borderRadius: 9999,
        flexShrink: 0,
        background: connected ? 'var(--c-success)' : 'var(--c-text-3)',
      }}
      aria-hidden
    />
  );
}

export function ProviderListItem({ label, connected, meta, active, onClick }: ProviderListItemProps) {
  return (
    <button
      className={`settings-list-item${active ? ' settings-list-item--active' : ''}`}
      onClick={onClick}
    >
      <StatusDot connected={connected} />
      <span className="settings-list-item-title">{label}</span>
      {meta != null && <span className="settings-list-item-meta">{meta}</span>}
    </button>
  );
}

interface ProviderListGroup {
  id: string;
  label: string;
  items: ProviderListItemProps[];
}

interface ProviderListProps {
  groups: ProviderListGroup[];
  emptyGroupRenderer?: (groupId: string) => ReactNode;
}

export function ProviderList({ groups, emptyGroupRenderer }: ProviderListProps) {
  return (
    <div className="settings-list-body">
      {groups.map((group) => (
        <div key={group.id} className="settings-provider-group">
          <div className="settings-provider-group-head">
            <span>{group.label}</span>
            <span className="settings-provider-group-count">{group.items.length}</span>
          </div>
          <div className="settings-provider-group-body">
            {group.items.length === 0
              ? emptyGroupRenderer?.(group.id)
              : group.items.map((item) => (
                  <ProviderListItem key={item.id} {...item} />
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}
