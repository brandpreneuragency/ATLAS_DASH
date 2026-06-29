import { useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import { CRMEmptyState } from '../components';
import { CompanyDetail } from '../detail/CompanyDetail';
import '../crm.css';

/**
 * Panel 2 for the CRM Companies page. Reads `activeCompanyId` from crmStore;
 * when no company is selected shows an empty state prompting the user to pick
 * one from Panel 1. Otherwise renders `<CompanyDetail>`, which already
 * composes the company header and the Overview/Contacts/Leads/Deals/Activity/
 * Files tab bar (with a "files coming soon" placeholder and a note input on
 * the Overview tab).
 */
export default function CRMCompaniesPage() {
  const { isLoaded, loadCrm, activeCompanyId, getCompanyById } = useCrmStore();

  useEffect(() => {
    if (!isLoaded) void loadCrm();
  }, [isLoaded, loadCrm]);

  const company = getCompanyById(activeCompanyId);

  if (!company) {
    return (
      <div className="crm-page">
        <CRMEmptyState
          icon={Building2}
          title={activeCompanyId ? 'Company not found' : 'No company selected'}
          subtitle={
            activeCompanyId
              ? 'This company may have been deleted. Pick another from the list on the left.'
              : 'Select a company from the list on the left to view its profile, contacts, leads, deals, and activity.'
          }
        />
      </div>
    );
  }

  return <CompanyDetail company={company} />;
}
