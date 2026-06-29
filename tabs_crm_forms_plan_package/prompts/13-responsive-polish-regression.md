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
