# Agent 08 — Form Builder Build Tab

You are implementing the Form Builder Build tab.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Form Builder section
- `planning/crm-forms/docs/03-data-model-and-state.md`
- existing UI input/card/button patterns

Goal:
Build the form builder structure and Build tab.

Tasks:
1. Add builder route/mode for selected form.
2. Panel 1:
   - Forms nav/list
   - selected form state
3. Panel 2:
   - builder topbar: form name, status, Save, Preview, Publish
   - tabs: Build, Style, Logic, Embed, Submissions, Settings
4. Build tab inner layout:
   - field palette/outline
   - form canvas
   - selected field inspector
5. Field types:
   - text, textarea, email, phone, number, select, radio, checkbox, date, file, hidden, consent, submit
6. Add field add/remove/reorder/update actions.
7. File field must be configurable but disabled in published embeds. Add exact TODO:

```ts
// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is included, but storage is not implemented yet.
// Future VPS agent must connect object/server storage, signed upload URLs,
// MIME/type validation, file size limits, security scanning, and attachment linking.
```

Panel 3:
- Form Assistant context with generate/improve/simplify placeholders.


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
- Builder opens for a selected form.
- Build tab can add/edit/remove supported fields.
- File upload is disabled for published embed output.
- Build passes.
