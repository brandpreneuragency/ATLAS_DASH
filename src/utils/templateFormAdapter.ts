import type { FormTemplate, LeadForm } from '../types/forms';

/** Adapts a saved template into the LeadForm shape consumed by the form builder UI. */
export function templateToLeadForm(template: FormTemplate): LeadForm {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    status: 'draft',
    ...template.schema,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}
