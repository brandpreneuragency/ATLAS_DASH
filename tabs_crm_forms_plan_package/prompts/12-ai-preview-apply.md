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
