# Agent 03 — Types, Stores, Services, Seed Data

You are implementing the CRM/Form data foundation.

Read first:

- `planning/crm-forms/docs/03-data-model-and-state.md`
- existing stores/services/types conventions
- existing Dexie/Zustand patterns

Goal:
Add typed local-first CRM/Form data models, stores, service boundaries, and realistic seed data.

Tasks:
1. Create/adapt `src/types/crm.ts`.
2. Create/adapt `src/types/forms.ts`.
3. Create/adapt `src/services/crmService.ts`.
4. Create/adapt `src/services/formsService.ts`.
5. Create/adapt `src/stores/crmStore.ts`.
6. Create/adapt `src/stores/formsStore.ts`.
7. Add realistic seed data matching the screenshot:
   - Sophia Martinez / Acme Corp
   - Liam Johnson / BrightWave Ltd
   - Emma Davis / Nova Systems
   - Noah Wilson / Vertex Solutions
   - Ava Thompson / Greenfield Co
   - deals around `$342,500` total pipeline
   - recent form submissions
8. Add duplicate handling by email.
9. Add future VPS comments exactly where relevant:

```ts
// CRM_FORMS_PUBLIC_CAPTURE_TODO:
// Production embedded forms require a public VPS/API endpoint.
// Implement public form rendering, submission ingestion, allowed-domain checks,
// CORS, rate limits, spam protection, duplicate matching, and CRM lead creation.
```

```ts
// CRM_FORMS_FILE_UPLOAD_TODO:
// File upload field UI/config is included, but storage is not implemented yet.
// Future VPS agent must connect object/server storage, signed upload URLs,
// MIME/type validation, file size limits, security scanning, and attachment linking.
```

```ts
// CRM_FORMS_WEBHOOK_DELIVERY_TODO:
// Webhook settings are stored now, but delivery/retry/logging is deferred.
// Future backend agent must implement signed payloads, timeouts, retries,
// webhook logs, failure states, and test-send action.
```

Do not build major UI in this agent.


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
- Types compile.
- Stores load seed data safely only when no data exists.
- Services hide persistence details from UI.
- Future VPS TODO comments exist.
- Build passes.
