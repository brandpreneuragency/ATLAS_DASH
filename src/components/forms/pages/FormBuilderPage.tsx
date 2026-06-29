// FormBuilderPage — thin entry for the Forms Builder sub-page.
// If no form is active, shows an empty state; otherwise mounts the FormBuilder
// shell, which reads the active form from the store itself.

import { useFormsStore } from '../../../stores/formsStore';
import { FormsEmptyState } from '../components/FormsEmptyState';
import FormBuilder from '../builder/FormBuilder';
import { FileEdit } from 'lucide-react';

export default function FormBuilderPage() {
  const activeFormId = useFormsStore((s) => s.activeFormId);

  if (!activeFormId) {
    return (
      <div className="forms-page forms-page--builder" style={{ padding: 0, gap: 0 }}>
        <FormsEmptyState
          icon={FileEdit}
          title="No form selected"
          subtitle="Pick a form in the left panel to open the builder."
        />
      </div>
    );
  }

  return (
    <div className="forms-page forms-page--builder" style={{ padding: 0, gap: 0 }}>
      <FormBuilder />
    </div>
  );
}
