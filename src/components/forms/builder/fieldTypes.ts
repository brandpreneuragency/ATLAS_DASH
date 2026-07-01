// Shared metadata for the 13 LeadFormField types: label, icon, default props,
// and a factory that produces the input shape expected by formsStore.addField.
// Kept here (builder-local) so FieldPalette, FormCanvas, FieldDetailsPanel, and
// LogicTab all agree on labels/icons/defaults without drifting.

import {
  Type,
  AlignLeft,
  Mail,
  Phone,
  Hash,
  List,
  Radio,
  CheckSquare,
  Calendar,
  Paperclip,
  EyeOff,
  CheckCircle,
  Send,
  type LucideIcon,
} from 'lucide-react';
import type { FormFieldType, LeadFormField, LeadFormOption } from '../../../types/forms';

export interface FieldTypeMeta {
  type: FormFieldType;
  label: string;
  icon: LucideIcon;
  /** True when the field accepts `options` (select/radio/checkbox). */
  hasOptions: boolean;
  /** True when the field accepts numeric min/max validation. */
  hasNumericValidation: boolean;
  /** True when the field accepts minLength/maxLength/pattern validation. */
  hasTextValidation: boolean;
  /** Builds the addField input (no id/order — store assigns them). */
  defaults: (label: string, name: string) => Omit<LeadFormField, 'id' | 'order'>;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function baseDefaults(
  type: FormFieldType,
  label: string,
  name: string,
  extra: Partial<LeadFormField> = {},
): Omit<LeadFormField, 'id' | 'order'> {
  return {
    type,
    label,
    name: name || slugify(label),
    required: false,
    ...extra,
  };
}

function blankOption(label: string, value: string): LeadFormOption {
  return { id: `${slugify(label)}_${value}`, label, value };
}

// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is intentionally included,
// but live upload storage is not implemented yet.
// Future VPS agent must connect this to object storage or server storage,
// signed upload URLs, MIME/type validation, file size limits,
// virus/security checks, and submission attachment linking
// before enabling production file uploads.
export const FIELD_TYPE_META: FieldTypeMeta[] = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: true,
    defaults: (label, name) => baseDefaults('text', label, name, { placeholder: 'Enter text' }),
  },
  {
    type: 'textarea',
    label: 'Textarea',
    icon: AlignLeft,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: true,
    defaults: (label, name) => baseDefaults('textarea', label, name, { placeholder: 'Enter message' }),
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: true,
    defaults: (label, name) =>
      baseDefaults('email', label, name, {
        placeholder: 'name@example.com',
        validation: { pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', message: 'Enter a valid email' },
      }),
  },
  {
    type: 'phone',
    label: 'Phone',
    icon: Phone,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: true,
    defaults: (label, name) => baseDefaults('phone', label, name, { placeholder: '+1 555 000 0000' }),
  },
  {
    type: 'number',
    label: 'Number',
    icon: Hash,
    hasOptions: false,
    hasNumericValidation: true,
    hasTextValidation: false,
    defaults: (label, name) => baseDefaults('number', label, name, { placeholder: '0' }),
  },
  {
    type: 'select',
    label: 'Select',
    icon: List,
    hasOptions: true,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) =>
      baseDefaults('select', label, name, {
        options: [blankOption('Option 1', 'option_1'), blankOption('Option 2', 'option_2')],
      }),
  },
  {
    type: 'radio',
    label: 'Radio',
    icon: Radio,
    hasOptions: true,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) =>
      baseDefaults('radio', label, name, {
        options: [blankOption('Yes', 'yes'), blankOption('No', 'no')],
      }),
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    icon: CheckSquare,
    hasOptions: true,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) =>
      baseDefaults('checkbox', label, name, {
        options: [blankOption('Option 1', 'option_1'), blankOption('Option 2', 'option_2')],
      }),
  },
  {
    type: 'date',
    label: 'Date',
    icon: Calendar,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) => baseDefaults('date', label, name),
  },
  {
    type: 'file',
    label: 'File Upload',
    icon: Paperclip,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: false,
    // File uploads are configurable in the builder but rendered DISABLED in
    // published embeds until VPS storage is wired up (see CRM_FORMS_FILE_UPLOAD_TODO).
    defaults: (label, name) =>
      baseDefaults('file', label, name, {
        disabledInPublishedEmbed: true,
        helpText: 'File upload is disabled until storage is connected.',
      }),
  },
  {
    type: 'hidden',
    label: 'Hidden',
    icon: EyeOff,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) => baseDefaults('hidden', label, name),
  },
  {
    type: 'consent',
    label: 'Consent',
    icon: CheckCircle,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) => baseDefaults('consent', label, name, { required: true }),
  },
  {
    type: 'submit',
    label: 'Submit',
    icon: Send,
    hasOptions: false,
    hasNumericValidation: false,
    hasTextValidation: false,
    defaults: (label, name) => baseDefaults('submit', label || 'Submit', name || 'submit'),
  },
];

const META_BY_TYPE: Record<FormFieldType, FieldTypeMeta> = FIELD_TYPE_META.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<FormFieldType, FieldTypeMeta>,
);

export function getFieldMeta(type: FormFieldType): FieldTypeMeta {
  return META_BY_TYPE[type];
}

export function getFieldLabel(type: FormFieldType): string {
  return META_BY_TYPE[type].label;
}

export function getFieldIcon(type: FormFieldType): LucideIcon {
  return META_BY_TYPE[type].icon;
}

/** Produces a sensible default field name from a label, deduped against existing names. */
export function uniqueFieldName(label: string, existingNames: string[]): string {
  const base = slugify(label) || 'field';
  if (!existingNames.includes(base)) return base;
  let i = 2;
  while (existingNames.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/** Build the addField input for a freshly clicked palette entry. */
export function newFieldInput(
  type: FormFieldType,
  existingNames: string[],
): Omit<LeadFormField, 'id' | 'order'> {
  const meta = META_BY_TYPE[type];
  const label = meta.type === 'submit' ? 'Submit' : meta.label;
  const name = uniqueFieldName(label, existingNames);
  return meta.defaults(label, name);
}
