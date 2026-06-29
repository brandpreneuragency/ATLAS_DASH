# TABS CRM + Forms Master Implementation Plan

## 0. Context

Repository: `https://github.com/brandpreneuragency/TABS.git`

Known public repo structure:

```text
src/
  assets/
  components/
  hooks/
  i18n/
  services/
  stores/
  types/
  utils/
  App.tsx
  App.css
  index.css
src-tauri/
public/
```

Known stack from `package.json`:

- React 19
- TypeScript
- Vite
- Tauri 2
- Zustand
- Dexie
- Lucide React
- Tiptap editor

Treat the existing app as a local-first Tauri/React app unless the repo clearly contains a server. Build the CRM/Form data layer behind service functions so a future VPS/API agent can replace local storage without rewriting the UI.

---

## 1. Product Goal

Add a full CRM module and a separate Forms module to TABS while preserving the visual and layout consistency of the existing task/doc modes.

The first perfected user journey:

```text
Create form → style it → copy embed code → receive lead/submission → view lead → ask CRM AI for follow-up
```

Primary user:

```text
Solo / small business user managing leads from embedded forms on websites.
```

---

## 2. Sidebar Modules

Add two top-level modules to the existing app sidebar:

```text
CRM
Forms
```

They are separate navigation modules.

Relationship:

```text
Forms collect submissions.
Submissions create/update leads.
Leads connect to contacts, companies, deals, tasks, notes, and activities.
```

---

## 3. Global Layout Contract

Every CRM and Forms page must preserve the same 3 flexible panels used by task/doc mode.

```text
┌──────────────┬──────────────────────┬──────────────────────────────────────┬─────────────────────────────┐
│ App Sidebar  │ Panel 1              │ Panel 2                              │ Panel 3                     │
│ global nav   │ module nav/list      │ active dashboard/detail/editor        │ CRM AI sidebar              │
└──────────────┴──────────────────────┴──────────────────────────────────────┴─────────────────────────────┘
```

### Panel Responsibilities

| Area | Responsibility |
|---|---|
| App sidebar | Global module switching: Home, Tasks, Docs, CRM, Forms, Reports, Settings |
| Panel 1 | Module navigation, list, filters, saved views |
| Panel 2 | Selected content, dashboard, detail, builder, table, Kanban, settings |
| Panel 3 | New CRM/Form AI sidebar using CRM Agents |

### Visual Consistency Rules

- Match current panel widths, gutters, dividers, and vertical rhythm.
- Match task/doc mode empty states, cards, border radius, muted greys, and subtle accents.
- Do not create a visually separate SaaS product inside the app.
- Reuse current layout components/classes where possible.
- Use existing design tokens/CSS variables before adding new ones.
- Avoid hardcoded sizes if equivalent tokens exist.
- If a size must be introduced, define it as a token or clearly scoped CSS variable.
- Keep Panel 3 layout connected to doc-mode AI sidebar so both can be styled together.
- CRM/Form-specific Panel 3 content must use CRM Agents, not Writers.

---

## 4. CRM Module Pages

### 4.1 CRM Dashboard

Route suggestion:

```text
/crm
/crm/dashboard
```

Panel 1:

- CRM module nav
- saved views
- quick filters
- recent objects

Panel 2:

- KPI cards:
  - New Leads
  - Open Deals
  - Conversion Rate
  - Tasks Due
- Recent Leads
- Follow-ups Due
- Pipeline Snapshot
- Recent Form Submissions
- Quick actions:
  - Add lead
  - Add company
  - Create follow-up task
  - Open Forms module

Panel 3:

- CRM Agents selector
- Suggested actions
- Quick prompts
- Context: CRM dashboard summary

---

### 4.2 Leads

Route suggestion:

```text
/crm/leads
/crm/leads/:leadId
```

Panel 1:

- CRM nav
- search leads
- filters: status, stage, source form, tags, owner, score
- saved views
- lead list

Panel 2:

Selected lead detail with tabs:

```text
Overview | Notes | Activity | Tasks | Form Data | Emails
```

Fields:

- name/title
- linked contact
- linked company
- email/phone via contact
- source form
- website/page URL
- UTM data
- status
- stage
- score
- owner
- tags
- notes
- created date
- last activity

Panel 3:

- selected lead summary
- suggested next step
- draft follow-up email button
- create task proposal
- lead scoring prompt

---

### 4.3 Contacts

Route suggestion:

```text
/crm/contacts
/crm/contacts/:contactId
```

Panel 1:

- search contacts
- filters
- contact list

Panel 2:

- contact profile
- linked company
- linked leads
- linked deals
- notes
- task links
- activity timeline

Fields:

- first name
- last name
- email
- phone
- job title
- company id
- lifecycle status
- tags
- notes

Panel 3:

- AI context: selected contact
- summarize relationship
- suggest outreach
- identify missing data

---

### 4.4 Companies

Route suggestion:

```text
/crm/companies
/crm/companies/:companyId
```

Panel 1:

- search companies
- filters
- company list

Panel 2:

- company profile
- contacts
- leads
- deals
- notes
- tasks
- activity timeline

Fields:

- company name
- website
- industry
- size
- country/city
- owner
- tags
- notes
- linked contacts/leads/deals

Panel 3:

- AI context: selected company
- company insights
- recommended follow-up

---

### 4.5 Pipeline

Route suggestion:

```text
/crm/pipeline
```

Panel 1:

- pipeline filters
- saved views
- owner/stage/date/value filters

Panel 2:

- top metric row:
  - Total Pipeline
  - Weighted Pipeline
  - Open Deals
  - Average Deal Size
- Kanban board with draggable-looking cards
- Default stages:

```text
New
Contacted
Qualified
Proposal
Won
Lost
Spam
```

Deal cards:

- title/company
- value
- linked contact/lead
- owner
- expected close date
- tag/chip

Panel 3:

- pipeline insights
- stuck deals
- next actions
- win-rate summary

---

### 4.6 Activities

Route suggestion:

```text
/crm/activities
```

Panel 1:

- activity filters
- type filters
- date filters

Panel 2:

Unified timeline:

- form submissions
- lead updates
- notes
- task links
- pipeline moves
- AI-applied actions
- exports
- emails later

Panel 3:

- summarize today/week
- identify stale leads
- detect important events

---

### 4.7 CRM Settings

Route suggestion:

```text
/crm/settings
```

Panel 2 tabs:

```text
Lead Fields | Stages | Tags | Notifications | Duplicate Handling | Export | Future API
```

Settings:

- default lead statuses
- pipeline stages
- tag management
- duplicate matching by email
- CSV export defaults
- notification placeholders
- local-first / future VPS API notes

---

## 5. Forms Module Pages

### 5.1 Forms Dashboard

Route suggestion:

```text
/forms
/forms/dashboard
```

Panel 1:

- Forms nav
- recent forms
- status filters

Panel 2:

- Active Forms
- Submissions
- Conversion
- Spam Blocked
- Recent Submissions
- Active Forms cards

Panel 3:

- AI context: forms dashboard
- improve forms
- analyze conversion
- create form from prompt

---

### 5.2 Forms List

Route suggestion:

```text
/forms/list
/forms/:formId
```

Panel 1:

- search forms
- filters:
  - Draft
  - Published
  - Archived
  - Has submissions
- form list

Panel 2:

Selected form summary:

- form name
- status
- submissions
- conversion
- spam
- allowed domains
- actions:
  - Open builder
  - Open style editor
  - View submissions
  - Get embed code
  - Duplicate
  - Save as template

Panel 3:

- AI context: selected form

---

### 5.3 Form Builder

Route suggestion:

```text
/forms/:formId/builder
```

Panel 1:

- form list
- form search
- selected form

Panel 2:

Top toolbar:

- form name
- Draft/Published/Archived status
- Save
- Preview
- Publish

Inner tabs:

```text
Build | Style | Logic | Embed | Submissions | Settings
```

Build tab layout:

```text
Field palette / Outline | Canvas | Field inspector drawer
```

Field types:

- text
- textarea
- email
- phone
- number
- select
- radio
- checkbox
- date
- file upload
- hidden field
- consent checkbox
- submit button

File upload production note:

```ts
// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is intentionally included,
// but live upload storage is not implemented yet.
// Future VPS agent must connect this to object storage or server storage,
// signed upload URLs, MIME/type validation, file size limits,
// virus/security checks, and submission attachment linking
// before enabling production file uploads.
```

Default behavior:

```text
File upload field can be configured in the builder.
Published embeds must show it disabled until VPS storage is connected.
```

Panel 3:

- generate fields
- improve labels
- simplify form
- create multi-step version
- preview/apply confirmation for changes

---

### 5.4 Style Tab

Controls:

- Colors
- Typography
- Layout
- Fields
- Buttons
- Borders
- Shadows
- Messages
- Custom CSS

Live preview modes:

```text
Desktop | Tablet | Mobile
```

Embed style isolation:

- App builder UI uses TABS design tokens.
- Published forms use isolated CSS variables.
- Custom CSS is stored separately and applied only to the published/preview form output.

---

### 5.5 Logic Tab

Sections:

- Steps
- Conditional rules
- Validation
- Hidden fields
- UTM capture

Supported hidden capture:

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
referrer
landing_page
page_url
device_type
submitted_at
```

Rule examples:

```text
If budget > 5000 → show project timeline
If service == Website → show current website URL
If country is empty → block submit
```

---

### 5.6 Embed Tab

Embed output tabs:

```text
iframe | HTML/script | React | Web Component
```

Required snippets:

Iframe:

```html
<iframe
  src="https://your-domain.com/embed/forms/FORM_ID"
  width="100%"
  height="640"
  style="border:0;"
></iframe>
```

HTML/script:

```html
<div data-tabs-form="FORM_ID"></div>
<script src="https://your-domain.com/embed/form.js"></script>
```

React:

```tsx
<TabsLeadForm formId="FORM_ID" />
```

Web Component:

```html
<tabs-lead-form form-id="FORM_ID"></tabs-lead-form>
<script src="https://your-domain.com/embed/web-component.js"></script>
```

Important future VPS note:

```ts
// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// The embed snippets are generated now, but production lead capture requires
// a public VPS/API endpoint. Future backend agent must implement public form
// rendering, allowed-domain validation, CORS policy, rate limiting, spam checks,
// submission persistence, duplicate matching, and CRM lead creation.
```

---

### 5.7 Submissions

Route suggestion:

```text
/forms/submissions
/forms/submissions/:submissionId
```

Panel 1:

- filters: New, Converted, Spam
- form filter
- source/domain filter
- submission list

Panel 2:

Selected submission detail:

- submitted fields
- UTM/source data
- spam score
- allowed domain result
- linked lead/contact/company
- convert/merge actions
- mark spam

Panel 3:

- summarize submission
- detect intent
- create lead follow-up
- create task

---

### 5.8 Templates

Route suggestion:

```text
/forms/templates
```

User-saved templates only.

Panel 2:

- template grid/list
- create form from template
- rename
- duplicate
- delete
- preview

No built-in template library in MVP.

---

### 5.9 Forms Settings

Route suggestion:

```text
/forms/settings
```

Tabs:

```text
Defaults | Spam Protection | Notifications | Webhooks | File Uploads | Embed Security | Export
```

Settings:

- default success message
- default notification email
- honeypot
- rate limit placeholder
- CAPTCHA later
- webhook URL/secret/enabled placeholder
- file uploads disabled until VPS storage connected
- allowed domains per form
- CSV export

Webhook note:

```ts
// CRM_FORMS_WEBHOOK_DELIVERY_TODO:
// Webhook settings are stored now, but delivery/retry/logging is deferred.
// Future backend agent must implement signed payloads, timeout handling,
// retry policy, webhook logs, failure states, and test-send action.
```

---

## 6. AI Sidebar Rules

Build a new CRM/Form AI sidebar component that shares layout/styling primitives with the doc-mode AI sidebar.

Do not reuse `Writers` as visible content.

Use `CRM Agents`:

```text
Lead Qualifier
Follow-up Writer
Pipeline Analyst
Form Assistant
```

AI context mapping:

| Page | Context |
|---|---|
| CRM Dashboard | dashboard metrics, recent leads, pipeline summary |
| Lead Detail | selected lead + linked contact/company/submissions/tasks |
| Contact Detail | selected contact + linked leads/deals/activity |
| Company Detail | selected company + contacts/leads/deals/activity |
| Pipeline | current pipeline, filters, deals, stuck deals |
| Forms Dashboard | form stats and recent submissions |
| Form Builder | selected form schema/style/logic |
| Submission Detail | selected submission + linked lead/contact/company |

All mutating AI actions use:

```text
Suggest → Preview → Apply
```

No destructive direct apply.

---

## 7. Backend / Storage Strategy

### MVP

Use existing local-first storage patterns if the app already uses Dexie/Zustand.

Recommended file areas:

```text
src/types/crm.ts
src/types/forms.ts
src/stores/crmStore.ts
src/stores/formsStore.ts
src/services/crmService.ts
src/services/formsService.ts
src/components/crm/*
src/components/forms/*
src/components/sidebar/CRMAISidebar.tsx
```

If repo has existing naming conventions, follow those instead.

### Future VPS

Prepare service abstraction now:

```text
UI → store → service → local adapter now / API adapter later
```

Do not hardwire all logic into React components.

Future VPS tasks:

- public embed rendering endpoint
- public submission API
- allowed-domain enforcement
- CORS policy
- spam protection / rate limits
- file upload storage
- webhook delivery
- email notifications
- server-side duplicate matching

---

## 8. Data Integrity Rules

Duplicate handling:

```text
If submitted email matches an existing contact/lead:
  attach submission as activity
  update lastActivityAt
  do not create duplicate contact
else:
  create contact + lead
```

Lead/contact/company separation:

- Lead is the sales/inquiry object.
- Contact is the person.
- Company is the organization.
- Deal is the pipeline opportunity.
- Submission is raw form data.

Do not merge these into one model.

---

## 9. Acceptance Criteria

The implementation is acceptable when:

- CRM and Forms appear as separate app sidebar modules.
- CRM pages keep the same 3-panel layout.
- Forms pages keep the same 3-panel layout.
- Panel 3 CRM AI sidebar appears on every CRM/Form page.
- CRM AI sidebar uses CRM Agents, not Writers.
- CRM dashboard, leads, contacts, companies, pipeline, activities, and settings exist.
- Forms dashboard, forms list, builder, submissions, templates, and settings exist.
- Form builder has Build, Style, Logic, Embed, Submissions, Settings tabs.
- Embed tab outputs iframe, HTML/script, React, and Web Component snippets.
- Allowed domains exist per form.
- User-saved templates exist.
- CSV export exists for leads and submissions.
- File upload is clearly marked as future VPS-connected functionality.
- Webhook delivery is clearly marked as future backend functionality.
- `npm run build` passes.
- Existing task/doc modes are not visually or functionally broken.
