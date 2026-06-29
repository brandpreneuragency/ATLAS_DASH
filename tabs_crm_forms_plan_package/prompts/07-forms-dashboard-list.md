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
