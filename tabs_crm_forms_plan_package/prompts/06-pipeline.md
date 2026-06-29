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
