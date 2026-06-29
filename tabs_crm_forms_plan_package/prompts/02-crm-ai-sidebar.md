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
