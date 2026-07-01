export type ProviderTabId = 'connection' | 'models' | 'defaults' | 'usage' | 'advanced';

export interface ProviderTab {
  id: ProviderTabId;
  label: string;
}

interface ProviderTabsProps {
  tabs: ProviderTab[];
  activeTab: ProviderTabId;
  onTabChange: (id: ProviderTabId) => void;
}

export function ProviderTabs({ tabs, activeTab, onTabChange }: ProviderTabsProps) {
  return (
    <div className="provider-detail-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`provider-detail-tab${activeTab === tab.id ? ' provider-detail-tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
