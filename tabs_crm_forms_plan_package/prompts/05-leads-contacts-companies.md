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
