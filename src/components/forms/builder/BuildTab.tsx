// BuildTab — three-column layout: FieldPalette | FormCanvas | FieldInspector.
// Local state holds the selected field id; reorder/add/remove go through the store.

import { useEffect, useState } from 'react';
import type { LeadForm } from '../../../types/forms';
import { FieldPalette } from './components/FieldPalette';
import { FormCanvas } from './components/FormCanvas';
import FieldInspector from './components/FieldInspector';

export default function BuildTab({ form }: { form: LeadForm }) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Clear selection if the selected field is removed externally.
  useEffect(() => {
    if (selectedFieldId && !form.fields.some((f) => f.id === selectedFieldId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedFieldId(null);
    }
  }, [form.fields, selectedFieldId]);

  // Reset selection when switching to a different form.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFieldId(null);
  }, [form.id]);

  const handleSelect = (id: string | null): void => setSelectedFieldId(id);

  return (
    <div className="forms-builder-build">
      <FieldPalette formId={form.id} existingFields={form.fields} />
      <FormCanvas
        form={form}
        selectedFieldId={selectedFieldId}
        onSelectField={handleSelect}
        onOpenInspector={() => undefined}
      />
      <FieldInspector form={form} fieldId={selectedFieldId} />
      {selectedFieldId !== null && (
        <div
          className="forms-builder-inspector-scrim"
          onClick={() => handleSelect(null)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
