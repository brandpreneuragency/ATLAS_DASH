import '../crm/crmLayout.css';
import { useUIStore, type CRMPage } from '../../stores/uiStore';
import CRMDashboardPage from '../crm/pages/CRMDashboardPage';
import CRMLeadsPage from '../crm/pages/CRMLeadsPage';
import CRMContactsPage from '../crm/pages/CRMContactsPage';
import CRMCompaniesPage from '../crm/pages/CRMCompaniesPage';
import CRMPipelinePage from '../crm/pages/CRMPipelinePage';
import CRMActivitiesPage from '../crm/pages/CRMActivitiesPage';
import CRMSettingsPage from '../crm/pages/CRMSettingsPage';

const CRM_PAGE_TITLES: Record<CRMPage, string> = {
  dashboard: 'CRM Dashboard',
  leads: 'Leads',
  contacts: 'Contacts',
  companies: 'Companies',
  pipeline: 'Pipeline',
  activities: 'Activities',
  settings: 'CRM Settings',
};

function renderCRMPage(page: CRMPage) {
  switch (page) {
    case 'dashboard':
      return <CRMDashboardPage />;
    case 'leads':
      return <CRMLeadsPage />;
    case 'contacts':
      return <CRMContactsPage />;
    case 'companies':
      return <CRMCompaniesPage />;
    case 'pipeline':
      return <CRMPipelinePage />;
    case 'activities':
      return <CRMActivitiesPage />;
    case 'settings':
      return <CRMSettingsPage />;
  }
}

export function CRMWorkspace() {
  const { activeCRMPage } = useUIStore();

  return (
    <div id="crm-workspace" className="panel flex-col h-full" style={{ background: 'rgba(233, 233, 233, 0)' }}>
      <div className="crm-workspace-header">
        <span className="crm-workspace-title">{CRM_PAGE_TITLES[activeCRMPage]}</span>
      </div>
      <div className="panel-body flex-1 h-full overflow-h">{renderCRMPage(activeCRMPage)}</div>
    </div>
  );
}
