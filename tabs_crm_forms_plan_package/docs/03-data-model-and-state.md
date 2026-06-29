# Data Model and State Plan

## Entity Overview

```text
Company
  ├── Contacts
  ├── Leads
  ├── Deals
  └── Activities

Form
  ├── Fields
  ├── Style Config
  ├── Logic Rules
  ├── Allowed Domains
  ├── Submissions
  └── User-Saved Templates

Submission
  └── Creates or updates Lead / Contact / Company
```

## CRM Types

Create or adapt:

```text
src/types/crm.ts
```

Recommended types:

```ts
export type CRMLeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost' | 'spam';
export type CRMDealStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost' | 'spam';
export type CRMActivityType =
  | 'lead_created'
  | 'lead_updated'
  | 'contact_created'
  | 'company_created'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'form_submitted'
  | 'note_added'
  | 'task_linked'
  | 'ai_suggestion_applied'
  | 'export_created'
  | 'email_sent'
  | 'email_opened';
```

Core interfaces:

```ts
export interface CRMContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  lifecycleStatus?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
}

export interface CRMCompany {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  city?: string;
  country?: string;
  ownerId?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
}

export interface CRMLead {
  id: string;
  contactId?: string;
  companyId?: string;
  title: string;
  status: CRMLeadStatus;
  stage: CRMDealStage;
  score?: number;
  ownerId?: string;
  tags: string[];
  source?: string;
  sourceFormId?: string;
  sourceSubmissionId?: string;
  sourcePageUrl?: string;
  utm?: CRMUtmData;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
}

export interface CRMDeal {
  id: string;
  title: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  stage: CRMDealStage;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CRMActivity {
  id: string;
  type: CRMActivityType;
  title: string;
  description?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  formId?: string;
  submissionId?: string;
  taskId?: string;
  createdAt: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}
```

## Form Types

Create or adapt:

```text
src/types/forms.ts
```

Recommended field types:

```ts
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
```

Core interfaces:

```ts
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
  disabledInPublishedEmbed?: boolean;
}

export interface LeadFormSubmission {
  id: string;
  formId: string;
  status: 'new' | 'converted' | 'spam';
  fields: Record<string, unknown>;
  hiddenFields: CRMUtmData & Record<string, unknown>;
  spamScore?: number;
  sourceDomain?: string;
  allowedDomainMatched?: boolean;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  createdAt: string;
}
```

## Store Strategy

Create or adapt:

```text
src/stores/crmStore.ts
src/stores/formsStore.ts
```

State should include:

### CRM store

- leads
- contacts
- companies
- deals
- activities
- notes
- active CRM route/object ids
- filters
- saved views
- CRUD actions
- derived selectors

### Forms store

- forms
- submissions
- templates
- active form id
- active builder tab
- preview mode
- form CRUD
- submission conversion actions
- template actions
- CSV export helpers

## Service Strategy

Create or adapt:

```text
src/services/crmService.ts
src/services/formsService.ts
```

Services should hide persistence details from UI.

Recommended architecture:

```text
React components → Zustand store → service → Dexie/local adapter now → VPS API adapter later
```

## Local Seed Data

Add realistic seed data matching the screenshot:

- Sophia Martinez / Acme Corp / hot lead
- Liam Johnson / BrightWave Ltd
- Emma Davis / Nova Systems
- Noah Wilson / Vertex Solutions
- Ava Thompson / Greenfield Co
- Pipeline values around `$342,500`
- Recent form submissions from Website Contact Form, Demo Request Form, Partnership Inquiry, Newsletter Signup

Seed data should only load when there is no existing CRM/Form data.

## Future VPS Comments

Add these comments close to service boundaries.

```ts
// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// Production embedded forms require a public VPS/API endpoint.
// Implement public form rendering, submission ingestion, allowed-domain checks,
// CORS, rate limits, spam protection, duplicate matching, and CRM lead creation.
```

```ts
// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is included, but storage is not implemented yet.
// Future VPS agent must connect object/server storage, signed upload URLs,
// MIME/type validation, file size limits, security scanning, and attachment linking.
```

```ts
// CRM_FORMS_WEBHOOK_DELIVERY_TODO:
// Webhook settings are stored now, but delivery/retry/logging is deferred.
// Future backend agent must implement signed payloads, timeouts, retries,
// webhook logs, failure states, and test-send action.
```

## CSV Export

Implement for:

- leads
- submissions

Suggested utility:

```text
src/utils/csvExport.ts
```

Export should escape commas, quotes, and newlines safely.
