import './crmLayout.css';
import {
  Activity,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  Plus,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useUIStore, type CRMPage } from '../../stores/uiStore';
import { useCrmStore } from '../../stores/crmStore';
import { ActivityFilters } from './lists/ActivityFilters';
import { CompanyList } from './lists/CompanyList';
import { ContactList } from './lists/ContactList';
import { DashboardSavedViews } from './lists/DashboardSavedViews';
import { LeadList } from './lists/LeadList';
import { PipelineFilters } from './lists/PipelineFilters';
import { SettingsNav } from './lists/SettingsNav';
import { useCrmSettingsTab } from './pages/CRMSettingsPage';

interface CRMNavItem {
  key: CRMPage;
  label: string;
  icon: LucideIcon;
}

const CRM_NAV_ITEMS: CRMNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'leads', label: 'Leads', icon: UserPlus },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { key: 'activities', label: 'Activities', icon: Activity },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const CRM_LIST_TITLES: Record<CRMPage, string> = {
  dashboard: 'Saved Views',
  leads: 'Leads',
  contacts: 'Contacts',
  companies: 'Companies',
  pipeline: 'Pipeline',
  activities: 'Activity',
  settings: 'Settings',
};

const ADD_LABELS: Partial<Record<CRMPage, string>> = {
  leads: 'Add lead',
  contacts: 'Add contact',
  companies: 'Add company',
  pipeline: 'Add deal',
};

/**
 * Panel 1 for the CRM module. Renders the module nav (Dashboard/Leads/
 * Contacts/Companies/Pipeline/Activities/Settings) with active highlight via
 * setActiveCRMPage, the per-page list/filter component, and a `+ Add` footer
 * for the entity pages. The list components read crmStore themselves; this
 * panel only composes them and wires the add buttons to the store's create
 * actions. Settings tab state is shared with CRMSettingsPage via
 * useCrmSettingsTab so clicking a section here switches Panel 2.
 */
export function CRMListPanel() {
  const { activeCRMPage, setActiveCRMPage } = useUIStore();
  const { createLead, createContact, createCompany, createDeal } = useCrmStore();
  const { tab: settingsTab, setTab: setSettingsTab } = useCrmSettingsTab();

  const addLabel = ADD_LABELS[activeCRMPage];

  const handleAdd = async () => {
    switch (activeCRMPage) {
      case 'leads': {
        const title = window.prompt('New lead title');
        if (title && title.trim()) {
          await createLead({ title: title.trim(), ownerId: 'you' });
        }
        break;
      }
      case 'contacts': {
        const name = window.prompt('New contact name (First Last)');
        if (!name || !name.trim()) break;
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0] ?? '';
        const lastName = parts.slice(1).join(' ');
        await createContact({ firstName, lastName });
        break;
      }
      case 'companies': {
        const name = window.prompt('New company name');
        if (name && name.trim()) {
          await createCompany({ name: name.trim(), ownerId: 'you' });
        }
        break;
      }
      case 'pipeline': {
        const title = window.prompt('New deal title');
        if (title && title.trim()) {
          await createDeal({ title: title.trim(), stage: 'new', ownerId: 'you', value: 0 });
        }
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      id="crm-list-panel"
      className="panel flex-col h-full overflow-hidden"
      style={{ marginLeft: '0px', marginRight: '0px' }}
    >
      <nav className="crm-list-nav" aria-label="CRM navigation">
        {CRM_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeCRMPage;
          return (
            <button
              key={item.key}
              type="button"
              title={item.label}
              onClick={() => setActiveCRMPage(item.key)}
              className={`crm-list-nav-item${isActive ? ' crm-list-nav-item--on' : ''}`}
            >
              <Icon size={14} className="crm-list-nav-item-icon" />
              <span className="crm-list-nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        className="crm-list-content ai-scroll flex-1 overflow-y-a h-full"
        style={{
          display: 'flex',
          flexDirection: 'column',
          paddingLeft: '18px',
          paddingRight: '12px',
          paddingTop: '12px',
        }}
      >
        <div className="crm-list-header">
          <span className="crm-list-header-title">{CRM_LIST_TITLES[activeCRMPage]}</span>
        </div>

        {activeCRMPage === 'dashboard' && <DashboardSavedViews />}
        {activeCRMPage === 'leads' && <LeadList />}
        {activeCRMPage === 'contacts' && <ContactList />}
        {activeCRMPage === 'companies' && <CompanyList />}
        {activeCRMPage === 'pipeline' && <PipelineFilters />}
        {activeCRMPage === 'activities' && <ActivityFilters />}
        {activeCRMPage === 'settings' && (
          <SettingsNav active={settingsTab} onChange={setSettingsTab} />
        )}
      </div>

      <div className="panel-footer crm-list-footer">
        {addLabel ? (
          <button
            type="button"
            className="crm-list-add-btn"
            title={addLabel}
            onClick={() => void handleAdd()}
          >
            <Plus size={14} />
            <span>{addLabel}</span>
          </button>
        ) : (
          <span className="crm-list-footer-hint subtle">{CRM_LIST_TITLES[activeCRMPage]}</span>
        )}
      </div>
    </div>
  );
}
