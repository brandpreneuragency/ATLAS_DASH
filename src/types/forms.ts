// Forms data model types.
// Local-first TABS Forms module. A Form owns fields, steps, logic rules,
// style config, embed config, submissions, and user-saved templates.
//
// Timestamps are ISO 8601 strings per docs/03-data-model-and-state.md.
// IDs are `string` (nanoid) to match the rest of the app.

import type { CRMUtmData } from './crm';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'hidden'
  | 'consent'
  | 'submit';

export type FormStatus = 'draft' | 'published' | 'archived';

export type FormSubmissionStatus = 'new' | 'converted' | 'spam';

// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is intentionally included,
// but live upload storage is not implemented yet.
// Future VPS agent must connect this to object storage or server storage,
// signed upload URLs, MIME/type validation, file size limits,
// virus/security checks, and submission attachment linking
// before enabling production file uploads.

export interface LeadFormOption {
  id: string;
  label: string;
  value: string;
}

export interface LeadFormValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  /** Message shown when validation fails. */
  message?: string;
}

export interface LeadFormField {
  id: string;
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: LeadFormOption[];
  validation?: LeadFormValidation;
  stepId?: string;
  order: number;
  /**
   * When true, this field is rendered disabled in published embeds. Used
   * primarily for the `file` field type until VPS storage is connected
   * (see CRM_FORMS_FILE_UPLOAD_TODO above).
   */
  disabledInPublishedEmbed?: boolean;
}

export interface LeadFormStep {
  id: string;
  title: string;
  description?: string;
  order: number;
  /** Optional show/hide condition referencing a logic rule id. */
  showWhenRuleId?: string;
}

export type LogicRuleType =
  | 'show_field'
  | 'hide_field'
  | 'show_step'
  | 'hide_step'
  | 'block_submit'
  | 'set_value';

export type LogicRuleOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is_empty'
  | 'is_not_empty';

export interface LeadFormLogicRule {
  id: string;
  type: LogicRuleType;
  /** Field id that triggers the rule. */
  triggerFieldId: string;
  operator: LogicRuleOperator;
  /** Comparison value (string/number). Omitted for is_empty/is_not_empty. */
  value?: string | number;
  /** Target field id(s) or step id(s) affected by the rule. */
  targetFieldIds?: string[];
  targetStepId?: string;
  /** Message shown when type === 'block_submit'. */
  message?: string;
  enabled: boolean;
}

export interface LeadFormStyleConfig {
  /** Hex color strings, kept loose so custom CSS can override. */
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  labelColor?: string;
  borderColor?: string;
  borderRadius?: number;
  fontFamily?: string;
  fontSize?: number;
  buttonStyle?: 'solid' | 'outline' | 'ghost';
  inputStyle?: 'boxed' | 'underline' | 'minimal';
  layout?: 'single' | 'two_column';
  padding?: number;

  // --- Typography (headings) ---
  /** Heading text color (e.g. step titles). Defaults to labelColor when unset. */
  headingColor?: string;
  /** Heading font size in px. Defaults to fontSize when unset. */
  headingFontSize?: number;

  // --- Fields ---
  /** Field/input background color. Overrides backgroundColor for inputs when set. */
  fieldBackgroundColor?: string;
  /** Field border color. Defaults to borderColor when unset. */
  fieldBorderColor?: string;
  /** Field border color on focus. Defaults to primaryColor when unset. */
  fieldFocusBorderColor?: string;
  /** Field text color. Defaults to textColor when unset. */
  fieldTextColor?: string;
  /** Extra vertical spacing between fields in px. Defaults to 0 (gap-based layout) when unset. */
  fieldSpacing?: number;

  // --- Borders ---
  /** Field border width in px. Defaults to 1 when unset. */
  borderWidth?: number;
  /** Field border style. Defaults to 'solid' when unset. */
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'none';

  // --- Shadows ---
  /** CSS box-shadow applied to inputs (non-focused). Defaults to none when unset. */
  fieldShadow?: string;
  /** CSS box-shadow applied to the embed root/card. Defaults to none when unset. */
  cardShadow?: string;

  // --- Buttons ---
  /** Solid button background color. Defaults to primaryColor when unset. */
  buttonBackgroundColor?: string;
  /** Solid button background color on hover. Defaults to the derived primary hover when unset. */
  buttonHoverBackgroundColor?: string;
  /** Button text color. Defaults to #fff for solid / primaryColor for outline+ghost when unset. */
  buttonTextColor?: string;

  // --- Messages ---
  /** Success message text color. Defaults to textColor when unset. */
  successColor?: string;
  /** Success message background color. Defaults to transparent when unset. */
  successBackgroundColor?: string;
  /** Error message text color. Overrides the default error red when set. */
  errorColor?: string;
  /** Error message background color. Defaults to the derived error-soft when unset. */
  errorBackgroundColor?: string;

  /** Custom CSS applied only to the published/preview form output (isolated). */
  customCss?: string;
}

// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// Production embedded forms require a public VPS/API endpoint.
// Implement public form rendering, submission ingestion, allowed-domain checks,
// CORS, rate limits, spam protection, duplicate matching, and CRM lead creation.

export interface LeadFormEmbedConfig {
  /** Domains allowed to embed this form. Empty = unrestricted (not recommended). */
  allowedDomains: string[];
  /** Default embed mode shown in the Embed tab. */
  defaultMode: 'iframe' | 'html_script' | 'react' | 'web_component';
  /** Iframe height hint in px. */
  iframeHeight?: number;
  /** Public base URL used when generating embed snippets. */
  publicBaseUrl?: string;
  /** Show the TABS brand badge on published forms. */
  showBranding?: boolean;
}

export interface LeadForm {
  id: string;
  name: string;
  description?: string;
  status: FormStatus;
  fields: LeadFormField[];
  steps: LeadFormStep[];
  logicRules: LeadFormLogicRule[];
  style: LeadFormStyleConfig;
  embed: LeadFormEmbedConfig;
  notificationEmail?: string;
  successMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFormSubmission {
  id: string;
  formId: string;
  status: FormSubmissionStatus;
  /** Submitted field values keyed by field name. */
  fields: Record<string, unknown>;
  /** Hidden/UTM capture merged into the submission. */
  hiddenFields: CRMUtmData & Record<string, unknown>;
  /** Honeypot field value, if present. Non-empty = likely bot. */
  honeypot?: string;
  /** 0..100 placeholder spam score. >threshold => status 'spam'. */
  spamScore?: number;
  sourceDomain?: string;
  allowedDomainMatched?: boolean;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  createdAt: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  /** Snapshot of the form schema (fields/steps/logic/style/embed) at save time. */
  schema: Omit<LeadForm, 'id' | 'name' | 'description' | 'status' | 'createdAt' | 'updatedAt'>;
  /** Optional category for grouping. */
  category?: string;
  createdAt: string;
  updatedAt: string;
}

// CRM_FORMS_WEBHOOK_DELIVERY_TODO:
// Webhook settings are stored now, but delivery/retry/logging is deferred.
// Future backend agent must implement signed payloads, timeouts, retries,
// webhook logs, failure states, and test-send action.

export interface WebhookConfig {
  id: string;
  formId: string;
  url: string;
  secret: string;
  enabled: boolean;
  /** Optional event filter; empty = all submission events. */
  events?: string[];
  createdAt: string;
  updatedAt: string;
}
