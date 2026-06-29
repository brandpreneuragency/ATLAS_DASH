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
