# Combined Copy-Ready Agent Prompts

---

## 00-master-orchestrator.md

# Agent 00 — Master Orchestrator

You are the orchestrator for adding a full CRM module and a separate Forms module to the TABS app.

Read first:

- `planning/crm-forms/docs/01-master-plan.md`
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- `planning/crm-forms/docs/03-data-model-and-state.md`
- `planning/crm-forms/docs/04-implementation-checklist.md`
- `planning/crm-forms/assets/crm-dashboard-4-views.png`

If the package is not in `planning/crm-forms/`, locate it and adjust paths mentally.

Goal:
Create a careful implementation sequence for this repo, then execute only the first safe repo-audit step. Do not build the full feature in one pass.

Tasks:
1. Confirm the current branch or create/use `feature/crm-form-builder`.
2. Inspect the existing app shell, sidebar, layout, doc-mode AI sidebar, task-mode panels, stores, services, and CSS token structure.
3. Create a short local implementation note file if the repo already has a planning/docs folder. Otherwise add `crm-forms-implementation-notes.md` at repo root.
4. List exact existing components/files that future agents should reuse.
5. Do not modify app behavior yet except for the notes file.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- You identify exact existing layout/sidebar/AI/sidebar files.
- You identify exact store/service patterns.
- You create or update only a small notes file.
- You do not break build.


---

## 01-layout-shell-and-sidebar.md

# Agent 01 — Layout Shell + Sidebar Modules

You are implementing the navigation and workspace shell for CRM and Forms.

Read first:

- `planning/crm-forms/docs/01-master-plan.md`
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- `planning/crm-forms/assets/crm-dashboard-4-views.png`
- the implementation notes created by Agent 00

Goal:
Add two separate top-level sidebar modules: `CRM` and `Forms`. Create a shared 3-panel workspace shell for CRM/Form pages without breaking existing task/doc modes.

Tasks:
1. Locate the existing app sidebar component and add `CRM` and `Forms` using the current icon/selected-state pattern.
2. Locate the app mode/routing state pattern. Add CRM/Form selection using the existing approach.
3. Create a reusable CRM/Form workspace shell that preserves:
   `App Sidebar → Panel 1 → Panel 2 → Panel 3`.
4. Create placeholder CRM dashboard and Forms dashboard screens with realistic empty/populated shells.
5. Ensure Panel 3 renders the new CRM AI sidebar placeholder, not the old Writers UI.
6. Keep panel sizes, dividers, top spacing, bottom input areas, and card styling consistent with task/doc mode.

Do not:
- Implement full CRM data logic yet.
- Refactor AppLayout broadly.
- Remove or alter task/doc mode behavior.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- CRM appears in app sidebar.
- Forms appears in app sidebar.
- Selecting CRM shows 3 panels.
- Selecting Forms shows 3 panels.
- Existing task/doc mode still works.
- Build passes.


---

## 02-crm-ai-sidebar.md

# Agent 02 — CRM AI Sidebar

You are implementing the new CRM/Form AI sidebar.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` section 6
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md` Panel 3 rules
- existing doc-mode AI sidebar component
- `planning/crm-forms/assets/crm-dashboard-4-views.png`

Goal:
Create a CRM-specific third panel that shares layout/styling with the doc-mode AI sidebar but uses CRM Agents instead of Writers.

Tasks:
1. Inspect the existing doc-mode AI sidebar structure/classes.
2. Create `CRMAISidebar` or equivalent using shared classes/layout primitives where possible.
3. Add agent selector/header labeled `CRM Agents`.
4. Add agents:
   - Lead Qualifier — Score and qualify new leads
   - Follow-up Writer — Draft personalized outreach
   - Pipeline Analyst — Analyze deals and forecast
   - Form Assistant — Map and improve forms
5. Add context sections that can vary by active view:
   - dashboard suggestions
   - lead summary
   - pipeline insights
   - company insights
   - form assistant
   - submission summary
6. Add bottom input matching current AI sidebar input styling.
7. Add non-destructive action pattern placeholders: `Suggest → Preview → Apply`.

Do not wire real AI calls unless a clean existing API exists. Use typed callbacks/placeholders.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- CRM/Form pages show the new CRM AI sidebar.
- It visually matches doc-mode sidebar structure.
- It does not show Writers.
- Context can be passed from active page.
- Build passes.


---

## 03-types-stores-services-seed.md

# Agent 03 — Types, Stores, Services, Seed Data

You are implementing the CRM/Form data foundation.

Read first:

- `planning/crm-forms/docs/03-data-model-and-state.md`
- existing stores/services/types conventions
- existing Dexie/Zustand patterns

Goal:
Add typed local-first CRM/Form data models, stores, service boundaries, and realistic seed data.

Tasks:
1. Create/adapt `src/types/crm.ts`.
2. Create/adapt `src/types/forms.ts`.
3. Create/adapt `src/services/crmService.ts`.
4. Create/adapt `src/services/formsService.ts`.
5. Create/adapt `src/stores/crmStore.ts`.
6. Create/adapt `src/stores/formsStore.ts`.
7. Add realistic seed data matching the screenshot:
   - Sophia Martinez / Acme Corp
   - Liam Johnson / BrightWave Ltd
   - Emma Davis / Nova Systems
   - Noah Wilson / Vertex Solutions
   - Ava Thompson / Greenfield Co
   - deals around `$342,500` total pipeline
   - recent form submissions
8. Add duplicate handling by email.
9. Add future VPS comments exactly where relevant:

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

Do not build major UI in this agent.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Types compile.
- Stores load seed data safely only when no data exists.
- Services hide persistence details from UI.
- Future VPS TODO comments exist.
- Build passes.


---

## 04-crm-dashboard.md

# Agent 04 — CRM Dashboard UI

You are implementing the CRM dashboard screen.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` CRM Dashboard section
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- `planning/crm-forms/assets/crm-dashboard-4-views.png`
- CRM store/service created by Agent 03

Goal:
Build the populated CRM Dashboard shown in the screenshot style.

Tasks:
1. Implement CRM Dashboard route/mode content.
2. Panel 1:
   - CRM navigation
   - saved views
   - recent objects/quick links if consistent
3. Panel 2:
   - KPI cards: New Leads, Open Deals, Conversion Rate, Tasks Due
   - Recent Leads card
   - Follow-ups Due card
   - Pipeline Snapshot card/chart or lightweight CSS chart
   - Recent Form Submissions table
   - quick actions
4. Panel 3:
   - pass dashboard context to CRMAISidebar
   - show suggestions and prompts relevant to dashboard
5. Match visual reference closely.

Do not implement other CRM pages except navigation placeholders if needed.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- CRM Dashboard is populated with seed data.
- It uses the same 3-panel layout.
- Visual spacing matches task/doc mode and screenshot.
- Build passes.


---

## 05-leads-contacts-companies.md

# Agent 05 — Leads, Contacts, Companies

You are implementing core CRM record management screens.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` sections 4.2–4.4
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- `planning/crm-forms/assets/crm-dashboard-4-views.png`
- CRM store/service/types

Goal:
Build Leads, Contacts, and Companies list/detail pages with populated data and contextual CRM AI sidebar.

Tasks:
1. Implement Leads page:
   - Panel 1 lead search/filter/list
   - Panel 2 selected lead detail
   - tabs: Overview, Notes, Activity, Tasks, Form Data, Emails
   - source/UTM card
   - notes and upcoming tasks card
   - status/stage/tag chips
2. Implement Contacts page:
   - Panel 1 search/filter/list
   - Panel 2 contact profile, linked company, leads, deals, activity, notes
3. Implement Companies page:
   - Panel 1 company search/list
   - Panel 2 company header, tabs, activity timeline, linked contacts/leads/deals
4. Panel 3:
   - pass selected lead/contact/company context to CRMAISidebar
5. Keep all record changes typed and routed through store/service actions.

Do not implement Pipeline Kanban in this agent.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Leads page matches screenshot logic.
- Contacts and Companies pages are usable and populated.
- AI sidebar changes context by selected record.
- Build passes.


---

## 06-pipeline.md

# Agent 06 — CRM Pipeline

You are implementing the CRM pipeline page.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Pipeline section
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md` Pipeline wireframe
- `planning/crm-forms/assets/crm-dashboard-4-views.png`
- CRM store/service/types

Goal:
Build a populated Kanban pipeline with filters, metrics, and AI insights.

Tasks:
1. Panel 1:
   - saved views
   - filters: owner, stage, close date, deal size
   - checkboxes: open deals only, include won/lost
2. Panel 2:
   - top metric row: Total Pipeline, Weighted Pipeline, Open Deals, Avg Deal Size
   - Kanban columns: New, Contacted, Qualified, Proposal, Won, Lost, Spam
   - deal cards with value, company, contact, owner, tags, close date
   - stage move action using store/service
3. Panel 3:
   - stuck deals card
   - biggest opportunity card
   - win-rate card
   - pipeline prompt input

Drag-and-drop can be visual/click-to-move first if full DnD would add risk.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Pipeline visually matches reference.
- Deals are grouped by stage.
- Stage updates persist in current store.
- Build passes.


---

## 07-forms-dashboard-list.md

# Agent 07 — Forms Dashboard + Forms List

You are implementing the separate Forms module dashboard and list pages.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Forms sections 5.1–5.2
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- Forms store/service/types

Goal:
Build the Forms module shell, dashboard, and forms list/summary.

Tasks:
1. Ensure Forms is separate from CRM in the app sidebar.
2. Forms Dashboard:
   - Panel 1 Forms nav/recent forms
   - Panel 2 KPI cards: Active Forms, Submissions, Conversion, Spam Blocked
   - Recent submissions list
   - Active forms cards
   - Panel 3 Form Assistant context
3. Forms List:
   - Panel 1 search/filter/form list
   - statuses: Draft, Published, Archived
   - Panel 2 selected form summary
   - actions: Open builder, Style editor, View submissions, Get embed code, Duplicate, Save as template
4. Implement user-saved template action as data operation.

Do not build full form builder yet.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Forms module is separate and functional.
- Forms dashboard/list are populated.
- Save-as-template exists.
- Build passes.


---

## 08-form-builder-build-tab.md

# Agent 08 — Form Builder Build Tab

You are implementing the Form Builder Build tab.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Form Builder section
- `planning/crm-forms/docs/03-data-model-and-state.md`
- existing UI input/card/button patterns

Goal:
Build the form builder structure and Build tab.

Tasks:
1. Add builder route/mode for selected form.
2. Panel 1:
   - Forms nav/list
   - selected form state
3. Panel 2:
   - builder topbar: form name, status, Save, Preview, Publish
   - tabs: Build, Style, Logic, Embed, Submissions, Settings
4. Build tab inner layout:
   - field palette/outline
   - form canvas
   - selected field inspector
5. Field types:
   - text, textarea, email, phone, number, select, radio, checkbox, date, file, hidden, consent, submit
6. Add field add/remove/reorder/update actions.
7. File field must be configurable but disabled in published embeds. Add exact TODO:

```ts
// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is included, but storage is not implemented yet.
// Future VPS agent must connect object/server storage, signed upload URLs,
// MIME/type validation, file size limits, security scanning, and attachment linking.
```

Panel 3:
- Form Assistant context with generate/improve/simplify placeholders.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Builder opens for a selected form.
- Build tab can add/edit/remove supported fields.
- File upload is disabled for published embed output.
- Build passes.


---

## 09-form-style-logic-tabs.md

# Agent 09 — Form Style + Logic Tabs

You are implementing advanced form styling and logic controls.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Style and Logic sections
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- Forms store/types

Goal:
Build Style and Logic tabs with live preview, responsive modes, validation, hidden fields, and conditional rules.

Tasks:
1. Style tab:
   - controls for colors, typography, layout, fields, buttons, borders, shadows, messages, custom CSS
   - live preview using same renderer as embed preview if possible
   - Desktop/Tablet/Mobile preview toggle
   - reset style action
2. Logic tab:
   - steps manager
   - conditional rule list/editor
   - validation controls
   - hidden fields/UTM capture section
3. Hidden captures:
   - utm_source, utm_medium, utm_campaign, utm_term, utm_content
   - referrer, landing_page, page_url, device_type, submitted_at
4. Store all style/logic in typed form config.
5. Do not let custom CSS affect the app shell; scope it to form preview/output only.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Style tab changes preview.
- Logic tab can create simple show/hide rules and validation settings.
- Preview modes exist.
- Build passes.


---

## 10-embed-submissions-export.md

# Agent 10 — Embed Output + Submissions + CSV Export

You are implementing form embed outputs, submission inbox, and CSV export.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Embed and Submissions sections
- `planning/crm-forms/docs/03-data-model-and-state.md`
- Forms/CRM services and stores

Goal:
Add the Embed tab outputs, allowed domains, submissions inbox, conversion to CRM, and CSV export.

Tasks:
1. Embed tab:
   - iframe snippet
   - HTML/script snippet
   - React snippet
   - Web Component snippet
   - copy buttons
   - base URL setting placeholder
   - allowed domains per form
2. Add exact future capture TODO near embed/public service boundary:

```ts
// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// Production embedded forms require a public VPS/API endpoint.
// Implement public form rendering, submission ingestion, allowed-domain checks,
// CORS, rate limits, spam protection, duplicate matching, and CRM lead creation.
```

3. Submissions page:
   - Panel 1 filters/list
   - Panel 2 selected submission detail
   - UTM/source data
   - spam score
   - linked lead/contact/company
   - convert/merge actions
4. Duplicate handling:
   - if email exists, attach submission/activity
   - else create contact + lead
5. CSV export:
   - leads export
   - submissions export
   - safe escaping for commas, quotes, newlines


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Embed tab outputs all four required snippets.
- Allowed domains per form exists.
- Submissions can convert/merge into CRM records.
- CSV export works.
- Build passes.


---

## 11-settings-webhooks-notifications.md

# Agent 11 — CRM/Forms Settings + Webhook/Notification Placeholders

You are implementing settings screens and future integration placeholders.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` CRM Settings and Forms Settings sections
- `planning/crm-forms/docs/03-data-model-and-state.md`

Goal:
Add CRM and Forms settings without implementing risky external delivery yet.

Tasks:
1. CRM Settings tabs:
   - Lead Fields
   - Stages
   - Tags
   - Notifications
   - Duplicate Handling
   - Export
   - Future API
2. Forms Settings tabs:
   - Defaults
   - Spam Protection
   - Notifications
   - Webhooks
   - File Uploads
   - Embed Security
   - Export
3. Webhooks:
   - UI fields: enabled, URL, secret, event types
   - store settings
   - do not implement delivery
   - add exact TODO:

```ts
// CRM_FORMS_WEBHOOK_DELIVERY_TODO:
// Webhook settings are stored now, but delivery/retry/logging is deferred.
// Future backend agent must implement signed payloads, timeouts, retries,
// webhook logs, failure states, and test-send action.
```

4. Notifications:
   - UI fields for default notification email and per-form notification email
   - store settings
   - if no backend exists, mark delivery as future VPS/API task
5. File uploads:
   - global disabled/connected state
   - clear explanation that upload storage must be connected on VPS before production


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Settings pages are usable.
- Webhook settings are stored but not delivered.
- Notification settings are stored.
- Future integration TODO comments exist.
- Build passes.


---

## 12-ai-preview-apply.md

# Agent 12 — AI Context + Preview/Apply Actions

You are wiring CRM/Form pages to the CRM AI sidebar context and safe action model.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` AI Sidebar Rules
- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md` Panel 3 rules
- existing AI store/service conventions

Goal:
Make the CRM AI sidebar context-aware and add a safe preview/apply mechanism for AI-suggested changes.

Tasks:
1. Define a typed CRM AI context object.
2. Map active page/object to context:
   - CRM dashboard
   - selected lead
   - selected contact
   - selected company
   - pipeline
   - forms dashboard
   - selected form/builder
   - selected submission
3. Add suggested action data structures.
4. Add preview/apply UI for suggestions.
5. Ensure applied actions go through store/service actions.
6. Log applied suggestions as CRM activities.
7. Do not make destructive changes without confirmation.
8. If real AI calls are not already cleanly available, keep generated output mocked/placeholder but typed.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- AI sidebar context changes with selected object/page.
- Suggested changes require preview/apply.
- Applied changes are logged.
- Build passes.


---

## 13-responsive-polish-regression.md

# Agent 13 — Responsive Polish + Regression QA

You are doing final polish and regression checks.

Read first:

- `planning/crm-forms/docs/02-ui-wireframes-and-layout-rules.md`
- `planning/crm-forms/docs/04-implementation-checklist.md`
- `planning/crm-forms/assets/crm-dashboard-4-views.png`

Goal:
Make CRM/Form pages visually consistent, responsive, and safe for existing app behavior.

Tasks:
1. Compare CRM/Form screens to screenshot and existing task/doc modes.
2. Fix spacing, card sizes, panel heights, dividers, typography, selected states, and bottom inputs.
3. Desktop:
   - all 3 panels visible.
4. Tablet:
   - Panel 1 or Panel 3 can collapse if existing pattern supports it.
5. Mobile:
   - stack or switch between nav/detail/AI.
   - Pipeline should use horizontal scroll or stage selector.
6. Check keyboard/focus states for important controls.
7. Check that existing doc/task mode still works.
8. Run:

```bash
npm run build
npm run lint
```

9. Fix TypeScript/build/lint errors.
10. Produce a final change summary and known limitations.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Build passes.
- Lint passes or all remaining lint issues are pre-existing and listed.
- CRM/Form pages visually match the intended design.
- Existing modes still work.


---

## 14-final-review.md

# Agent 14 — Final Review and Hardening

You are the final reviewer. Do not add features unless required to fix breakage.

Read first:

- `planning/crm-forms/docs/04-implementation-checklist.md`
- final change summaries from previous agents

Goal:
Review the full CRM/Form implementation for correctness, consistency, and missing requirements.

Tasks:
1. Verify every checklist item.
2. Search for hardcoded colors/sizes that should use tokens.
3. Search for missing TODOs:
   - `CRM_FORMS_PUBLIC_CAPTURE_TODO`
   - `CRM_FORMS_FILE_UPLOAD_TODO`
   - `CRM_FORMS_WEBHOOK_DELIVERY_TODO`
4. Verify CRM and Forms are separate modules.
5. Verify Panel 3 uses CRM Agents.
6. Verify no visible Writers content appears in CRM/Form AI sidebar.
7. Verify embedded form file upload is disabled until backend storage is connected.
8. Verify duplicate handling by email.
9. Verify CSV export escaping.
10. Run build/lint.
11. Produce final handoff notes.


Common rules for every agent:
- Work on branch `feature/crm-form-builder` unless already there.
- Read the relevant package docs before editing.
- Inspect the existing repo structure and follow current naming/style conventions.
- Preserve task mode and doc mode behavior.
- Preserve the current 3-panel visual logic.
- Use existing design tokens/CSS variables before adding new ones.
- Do not hardcode colors, spacing, panel widths, shadows, or radius unless existing code already does and there is no token.
- Do not create unrelated files.
- Do not broadly refactor existing code.
- Run `npm run build` and `npm run lint` after changes when possible.
- Report changed files, key decisions, and any blockers.


Acceptance:
- Final review is complete.
- All blockers are fixed or clearly listed.
- Build passes.


