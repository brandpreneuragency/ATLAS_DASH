import '../forms/formsLayout.css';
import { useUIStore, type FormsPage } from '../../stores/uiStore';
import FormsDashboardPage from '../forms/pages/FormsDashboardPage';
import FormsListPage from '../forms/pages/FormsListPage';
import FormBuilderPage from '../forms/pages/FormBuilderPage';
import FormsSubmissionsPage from '../forms/pages/FormsSubmissionsPage';
import FormsSettingsPage from '../forms/pages/FormsSettingsPage';

function renderFormsPage(page: FormsPage) {
  switch (page) {
    case 'dashboard':
      return <FormsDashboardPage />;
    case 'list':
    case 'templates':
      return <FormsListPage />;
    case 'builder':
      return <FormBuilderPage />;
    case 'submissions':
      return <FormsSubmissionsPage />;
    case 'settings':
      return <FormsSettingsPage />;
  }
}

export function FormsWorkspace() {
  const { activeFormsPage } = useUIStore();

  return (
    <div id="forms-workspace" className="panel flex-col h-full w-full min-w-0" style={{ background: 'rgba(233, 233, 233, 0)' }}>
      <div className="panel-body flex-1 overflow-y-a">{renderFormsPage(activeFormsPage)}</div>
    </div>
  );
}
