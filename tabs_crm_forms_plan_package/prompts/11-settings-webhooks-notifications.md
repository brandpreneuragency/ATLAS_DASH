# Agent 11 — CRM/Forms Settings + Webhook/Notification Placeholders

You are implementing settings screens and future integration placeholders.

Read first:

- `planning/crm-forms/docs/01-master-plan.md` CRM Settings and Forms Settings sections
- `planning/crm-forms/docs/03-data-model-and-state.md`

Goal:
Add CRM and Forms settings without implementing risky external delivery yet.

Tasks:
1. CRM Settings tabs:
   - Lead Fields
   - Stages
   - Tags
   - Notifications
   - Duplicate Handling
   - Export
   - Future API
2. Forms Settings tabs:
   - Defaults
   - Spam Protection
   - Notifications
   - Webhooks
   - File Uploads
   - Embed Security
   - Export
3. Webhooks:
   - UI fields: enabled, URL, secret, event types
   - store settings
   - do not implement delivery
   - add exact TODO:

```ts
// CRM_FORMS_WEBHOOK_DELIVERY_TODO:
// Webhook settings are stored now, but delivery/retry/logging is deferred.
// Future backend agent must implement signed payloads, timeouts, retries,
// webhook logs, failure states, and test-send action.
```

4. Notifications:
   - UI fields for default notification email and per-form notification email
   - store settings
   - if no backend exists, mark delivery as future VPS/API task
5. File uploads:
   - global disabled/connected state
   - clear explanation that upload storage must be connected on VPS before production


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
- Settings pages are usable.
- Webhook settings are stored but not delivered.
- Notification settings are stored.
- Future integration TODO comments exist.
- Build passes.
