# TABS CRM + Forms Implementation Package

This package contains the CRM + Forms module implementation plan, visual reference, and copy-ready agent prompts.

## Package contents

```text
assets/crm-dashboard-4-views.png
  High-fidelity 4-screen CRM reference image.

docs/01-master-plan.md
  Full CRM + Forms implementation plan.

docs/02-ui-wireframes-and-layout-rules.md
  Page-level layout rules, panel logic, and UI specs.

docs/03-data-model-and-state.md
  CRM/Form entities, Zustand/Dexie state strategy, and future VPS notes.

docs/04-implementation-checklist.md
  Phase-by-phase checklist and acceptance criteria.

prompts/*.md
  Copy-ready prompts to give to coding agents sequentially.
```

## How to use

1. Put the package next to the local TABS repo or inside a `/planning/crm-forms/` folder.
2. Open `assets/crm-dashboard-4-views.png` before each UI agent.
3. Start with `prompts/00-master-orchestrator.md`.
4. Then run agents in numerical order.
5. After each coding agent, run:

```bash
npm run build
npm run lint
```

If the repo has existing stricter commands, use those too.

## Non-negotiable product decisions

- Add two separate top-level sidebar modules: `CRM` and `Forms`.
- Keep the existing 3 flexible panel logic across all CRM/Form pages.
- Panel 3 is a new CRM-specific AI sidebar, visually linked to the doc-mode AI sidebar layout.
- CRM AI sidebar uses `CRM Agents`, not `Writers`.
- Forms module is separate from CRM, but submissions create/update CRM leads.
- Full CRM from the start: Leads, Contacts, Companies, Deals/Pipeline, Activities, Notes, Tasks links, Forms, Submissions, Templates, Settings.
- Form builder supports iframe, HTML/script, React snippet, and Web Component snippet.
- File upload UI exists, but production upload storage is a future VPS connection task.
- Webhook UI/data placeholders exist now; full delivery/retry/logging can be implemented later.
- Embed security uses allowed domains per form.
