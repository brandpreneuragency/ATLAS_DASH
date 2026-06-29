import { useEffect } from 'react';
import { Users } from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import { CRMEmptyState } from '../components';
import { ContactDetail } from '../detail/ContactDetail';
import '../crm.css';

/**
 * Panel 2 for the CRM Contacts page. Reads `activeContactId` from crmStore;
 * when no contact is selected shows an empty state prompting the user to pick
 * one from Panel 1. Otherwise renders `<ContactDetail>`, which already
 * composes the contact header and the Profile/Leads/Deals/Activity/Notes tab
 * bar (including the bottom note input on the Notes tab).
 */
export default function CRMContactsPage() {
  const { isLoaded, loadCrm, activeContactId, getContactById } = useCrmStore();

  useEffect(() => {
    if (!isLoaded) void loadCrm();
  }, [isLoaded, loadCrm]);

  const contact = getContactById(activeContactId);

  if (!contact) {
    return (
      <div className="crm-page">
        <CRMEmptyState
          icon={Users}
          title={activeContactId ? 'Contact not found' : 'No contact selected'}
          subtitle={
            activeContactId
              ? 'This contact may have been deleted. Pick another from the list on the left.'
              : 'Select a contact from the list on the left to view their profile, linked leads and deals, activity, and notes.'
          }
        />
      </div>
    );
  }

  return <ContactDetail contact={contact} />;
}
