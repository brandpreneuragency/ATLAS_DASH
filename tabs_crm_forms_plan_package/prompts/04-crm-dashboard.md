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
