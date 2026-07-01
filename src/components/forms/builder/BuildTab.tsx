// BuildTab — two-column layout: FieldPalette | FormCanvas.

import { useEffect, useState } from 'react';
import type { LeadForm } from '../../../types/forms';
import { FieldPalette } from './components/FieldPalette';
import { FormCanvas } from './components/FormCanvas';

export default function BuildTab({ form }: { form: LeadForm }) {
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (expandedFieldId && !form.fields.some((f) => f.id === expandedFieldId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExpandedFieldId(null);
    }
  }, [form.fields, expandedFieldId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedFieldId(null);
  }, [form.id]);

  return (
    <div className="forms-builder-build">
      <FieldPalette formId={form.id} existingFields={form.fields} />
      <FormCanvas
        form={form}
        expandedFieldId={expandedFieldId}
        onToggleField={setExpandedFieldId}
      />
    </div>
  );
}
