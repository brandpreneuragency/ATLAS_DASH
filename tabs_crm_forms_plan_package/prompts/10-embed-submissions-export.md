# Agent 10 — Embed Output + Submissions + CSV Export

You are implementing form embed outputs, submission inbox, and CSV export.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` Embed and Submissions sections
- `planning/crm-forms/docs/03-data-model-and-state.md`
- Forms/CRM services and stores

Goal:
Add the Embed tab outputs, allowed domains, submissions inbox, conversion to CRM, and CSV export.

Tasks:
1. Embed tab:
   - iframe snippet
   - HTML/script snippet
   - React snippet
   - Web Component snippet
   - copy buttons
   - base URL setting placeholder
   - allowed domains per form
2. Add exact future capture TODO near embed/public service boundary:

```ts
// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// Production embedded forms require a public VPS/API endpoint.
// Implement public form rendering, submission ingestion, allowed-domain checks,
// CORS, rate limits, spam protection, duplicate matching, and CRM lead creation.
```

3. Submissions page:
   - Panel 1 filters/list
   - Panel 2 selected submission detail
   - UTM/source data
   - spam score
   - linked lead/contact/company
   - convert/merge actions
4. Duplicate handling:
   - if email exists, attach submission/activity
   - else create contact + lead
5. CSV export:
   - leads export
   - submissions export
   - safe escaping for commas, quotes, newlines


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
- Embed tab outputs all four required snippets.
- Allowed domains per form exists.
- Submissions can convert/merge into CRM records.
- CSV export works.
- Build passes.
