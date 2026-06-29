import '../forms/formsLayout.css';
import { useUIStore, type FormsPage } from '../../stores/uiStore';
import FormsDashboardPage from '../forms/pages/FormsDashboardPage';
import FormsListPage from '../forms/pages/FormsListPage';
import FormBuilderPage from '../forms/pages/FormBuilderPage';
import FormsSubmissionsPage from '../forms/pages/FormsSubmissionsPage';
import FormsTemplatesPage from '../forms/pages/FormsTemplatesPage';
import FormsSettingsPage from '../forms/pages/FormsSettingsPage';

const FORMS_PAGE_TITLES: Record<FormsPage, string> = {
  dashboard: 'Forms Dashboard',
  list: 'Forms',
  builder: 'Form Builder',
  submissions: 'Submissions',
  templates: 'Templates',
  settings: 'Forms Settings',
};

function renderFormsPage(page: FormsPage) {
  switch (page) {
    case 'dashboard':
      return <FormsDashboardPage />;
    case 'list':
      return <FormsListPage />;
    case 'builder':
      return <FormBuilderPage />;
    case 'submissions':
      return <FormsSubmissionsPage />;
    case 'templates':
      return <FormsTemplatesPage />;
    case 'settings':
      return <FormsSettingsPage />;
  }
}

export function FormsWorkspace() {
  const { activeFormsPage } = useUIStore();

  return (
    <div id="forms-workspace" className="panel flex-col h-full" style={{ background: 'rgba(233, 233, 233, 0)' }}>
      <div className="forms-workspace-header">
        <span className="forms-workspace-title">{FORMS_PAGE_TITLES[activeFormsPage]}</span>
      </div>
      <div className="panel-body flex-1 h-full overflow-h">{renderFormsPage(activeFormsPage)}</div>
    </div>
  );
}
