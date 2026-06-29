# Agent 14 — Final Review and Hardening

You are the final reviewer. Do not add features unless required to fix breakage.

Read first:

- `planning/crm-forms/docs/04-implementation-checklist.md`
- final change summaries from previous agents

Goal:
Review the full CRM/Form implementation for correctness, consistency, and missing requirements.

Tasks:
1. Verify every checklist item.
2. Search for hardcoded colors/sizes that should use tokens.
3. Search for missing TODOs:
   - `CRM_FORMS_PUBLIC_CAPTURE_TODO`
   - `CRM_FORMS_FILE_UPLOAD_TODO`
   - `CRM_FORMS_WEBHOOK_DELIVERY_TODO`
4. Verify CRM and Forms are separate modules.
5. Verify Panel 3 uses CRM Agents.
6. Verify no visible Writers content appears in CRM/Form AI sidebar.
7. Verify embedded form file upload is disabled until backend storage is connected.
8. Verify duplicate handling by email.
9. Verify CSV export escaping.
10. Run build/lint.
11. Produce final handoff notes.


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
- Final review is complete.
- All blockers are fixed or clearly listed.
- Build passes.
