import { useEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import { useFormsStore } from '../../../stores/formsStore';
import { CRMEmptyState } from '../components';
import { LeadDetail } from '../detail/LeadDetail';
import '../crm.css';

/**
 * Panel 2 for the CRM Leads page. Reads `activeLeadId` from crmStore; when no
 * lead is selected (or the selected one was deleted) shows an empty state
 * prompting the user to pick a lead from Panel 1. Otherwise renders
 * `<LeadDetail>`, which already composes the lead header, the
 * Overview/Notes/Activity/Tasks/Form Data/Emails tab bar, and the bottom note
 * input — so this page is a thin wrapper around the existing component.
 */
export default function CRMLeadsPage() {
  const { isLoaded, loadCrm, activeLeadId, getLeadById } = useCrmStore();
  const { isLoaded: formsLoaded, loadForms } = useFormsStore();

  useEffect(() => {
    if (!isLoaded) void loadCrm();
  }, [isLoaded, loadCrm]);

  // LeadDetail looks up the source submission via formsStore for the
  // "Form Data" tab, so make sure forms data is available even when the user
  // lands directly on the Leads page (e.g. persisted activeCRMPage on startup).
  useEffect(() => {
    if (!formsLoaded) void loadForms();
  }, [formsLoaded, loadForms]);

  const lead = getLeadById(activeLeadId);

  if (!lead) {
    return (
      <div className="crm-page">
        <CRMEmptyState
          icon={UserPlus}
          title={activeLeadId ? 'Lead not found' : 'No lead selected'}
          subtitle={
            activeLeadId
              ? 'This lead may have been deleted. Pick another from the list on the left.'
              : 'Select a lead from the list on the left to see its overview, notes, activity, tasks, source submission, and emails.'
          }
        />
      </div>
    );
  }

  return <LeadDetail lead={lead} />;
}
