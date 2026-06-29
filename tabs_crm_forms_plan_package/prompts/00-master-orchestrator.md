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
