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
