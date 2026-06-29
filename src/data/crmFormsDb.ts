// CRM + Forms Dexie persistence.
//
// DESIGN CHOICE — companion database:
// The app's primary Dexie db (`ZenEditorDB` in src/services/db.ts) is owned by
// another agent and must not be edited. Dexie's version semantics drop any
// object store that is omitted from a new version's `stores()` declaration, so
// opening `ZenEditorDB` from this file at a higher version with only CRM/forms
// tables would DELETE the existing documents/tasks/projects tables.
//
// Per the data-agent instructions ("or a clearly-named companion db"), we open
// a SEPARATE IndexedDB database named `ZenEditorCRMFormsDB`. This keeps the
// CRM/forms data isolated and avoids any risk to the existing db. The class
// structure, version chain, `Table<T>!` declarations, and index style match
// the existing `ZenEditorDB` pattern exactly so a future merge is trivial.
//
// A future VPS agent can replace this adapter with an API client without
// touching UI/store code.

import Dexie, { type Table } from 'dexie';
import type {
  CRMLead,
  CRMContact,
  CRMCompany,
  CRMDeal,
  CRMActivity,
  CRMNote,
  CRMTaskLink,
  CRMSavedView,
  PipelineStage,
} from '../types/crm';
import type {
  LeadForm,
  LeadFormSubmission,
  FormTemplate,
  WebhookConfig,
} from '../types/forms';

export interface CRMSettingsRecord {
  key: string;
  value: string | number | boolean | Record<string, unknown>;
}

class ZenEditorCRMFormsDB extends Dexie {
  crmLeads!: Table<CRMLead, string>;
  crmContacts!: Table<CRMContact, string>;
  crmCompanies!: Table<CRMCompany, string>;
  crmDeals!: Table<CRMDeal, string>;
  crmActivities!: Table<CRMActivity, string>;
  crmNotes!: Table<CRMNote, string>;
  crmTaskLinks!: Table<CRMTaskLink, string>;
  crmSavedViews!: Table<CRMSavedView, string>;
  crmPipelineStages!: Table<PipelineStage, string>;

  forms!: Table<LeadForm, string>;
  formSubmissions!: Table<LeadFormSubmission, string>;
  formTemplates!: Table<FormTemplate, string>;
  formWebhooks!: Table<WebhookConfig, string>;

  crmSettings!: Table<CRMSettingsRecord, string>;

  constructor() {
    super('ZenEditorCRMFormsDB');
    this.version(1).stores({
      crmLeads: 'id, status, stage, contactId, companyId, ownerId, source, sourceFormId, createdAt, updatedAt, lastActivityAt',
      crmContacts: 'id, email, companyId, createdAt, updatedAt, lastActivityAt',
      crmCompanies: 'id, name, industry, ownerId, createdAt, updatedAt, lastActivityAt',
      crmDeals: 'id, stage, leadId, contactId, companyId, ownerId, createdAt, updatedAt',
      crmActivities: 'id, type, leadId, contactId, companyId, dealId, formId, submissionId, taskId, createdAt',
      crmNotes: 'id, leadId, contactId, companyId, dealId, createdAt, updatedAt',
      crmTaskLinks: 'id, taskId, leadId, contactId, companyId, dealId, createdAt',
      crmSavedViews: 'id, entity, isDefault, createdAt, updatedAt',
      crmPipelineStages: 'id, key, order',

      forms: 'id, status, name, createdAt, updatedAt',
      formSubmissions: 'id, formId, status, sourceDomain, leadId, contactId, companyId, createdAt',
      formTemplates: 'id, name, category, createdAt, updatedAt',
      formWebhooks: 'id, formId, enabled, createdAt, updatedAt',

      crmSettings: 'key',
    });
  }
}

export const crmFormsDb = new ZenEditorCRMFormsDB();

// ---------------------------------------------------------------------------
// Settings helpers (mirror the getSetting/setSetting pattern from db.ts)
// ---------------------------------------------------------------------------

export async function getCrmSetting<T>(
  key: string,
  defaultValue: T,
): Promise<T> {
  const row = await crmFormsDb.crmSettings.get(key);
  if (row === undefined) return defaultValue;
  return row.value as T;
}

export async function setCrmSetting(
  key: string,
  value: string | number | boolean | Record<string, unknown>,
): Promise<void> {
  await crmFormsDb.crmSettings.put({ key, value });
}

// ---------------------------------------------------------------------------
// Emptiness checks (used by services to decide whether to seed)
// ---------------------------------------------------------------------------

export async function isCrmDataEmpty(): Promise<boolean> {
  const [leads, contacts, companies, deals] = await Promise.all([
    crmFormsDb.crmLeads.count(),
    crmFormsDb.crmContacts.count(),
    crmFormsDb.crmCompanies.count(),
    crmFormsDb.crmDeals.count(),
  ]);
  return leads + contacts + companies + deals === 0;
}

export async function isFormsDataEmpty(): Promise<boolean> {
  const [forms, submissions, templates] = await Promise.all([
    crmFormsDb.forms.count(),
    crmFormsDb.formSubmissions.count(),
    crmFormsDb.formTemplates.count(),
  ]);
  return forms + submissions + templates === 0;
}
