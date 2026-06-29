# Implementation Checklist

## Phase 0 — Branch and Audit

- [ ] Create branch `feature/crm-form-builder`.
- [ ] Inspect current layout components.
- [ ] Identify current app sidebar component.
- [ ] Identify doc-mode AI sidebar component.
- [ ] Identify task-mode panel/list/detail components.
- [ ] Identify current store/service persistence pattern.
- [ ] Write short implementation notes before editing.

## Phase 1 — Layout Shell

- [ ] Add `CRM` and `Forms` to app sidebar.
- [ ] Add CRM/Form mode or routing state using existing app pattern.
- [ ] Create shared CRM/Form workspace shell.
- [ ] Keep App Sidebar → Panel 1 → Panel 2 → Panel 3.
- [ ] Create new CRM AI sidebar connected visually to doc-mode AI sidebar.
- [ ] Do not break doc/task modes.

## Phase 2 — Types, Stores, Services

- [ ] Add CRM types.
- [ ] Add Forms types.
- [ ] Add CRM store/service.
- [ ] Add Forms store/service.
- [ ] Add seed data.
- [ ] Add future VPS TODO comments.
- [ ] Add duplicate handling logic by email.

## Phase 3 — CRM Dashboard

- [ ] Build CRM dashboard Panel 1.
- [ ] Build KPI cards.
- [ ] Build recent leads card.
- [ ] Build follow-ups due card.
- [ ] Build pipeline snapshot.
- [ ] Build recent submissions table.
- [ ] Connect Panel 3 CRM AI context.

## Phase 4 — Leads, Contacts, Companies

- [ ] Build leads list/detail.
- [ ] Build lead tabs.
- [ ] Build contacts list/detail.
- [ ] Build companies list/detail.
- [ ] Build activity timeline.
- [ ] Link records correctly.

## Phase 5 — Pipeline

- [ ] Build pipeline filters/saved views.
- [ ] Build summary metric row.
- [ ] Build Kanban columns.
- [ ] Build deal cards.
- [ ] Add stage move action.
- [ ] Connect AI pipeline insights.

## Phase 6 — Forms Dashboard/List

- [ ] Build Forms app sidebar route/mode.
- [ ] Build Forms dashboard.
- [ ] Build Forms list and selected summary.
- [ ] Add status filters.
- [ ] Add save-as-template action.

## Phase 7 — Form Builder

- [ ] Build builder topbar.
- [ ] Build tabs: Build, Style, Logic, Embed, Submissions, Settings.
- [ ] Build field palette.
- [ ] Build form canvas.
- [ ] Build field inspector.
- [ ] Support all MVP field types.
- [ ] Add disabled published behavior for file upload.

## Phase 8 — Style + Logic

- [ ] Build style controls.
- [ ] Build live preview.
- [ ] Add Desktop/Tablet/Mobile preview toggle.
- [ ] Add custom CSS tab/area.
- [ ] Build step manager.
- [ ] Build conditional logic UI.
- [ ] Build validation UI.
- [ ] Add UTM hidden capture fields.

## Phase 9 — Embed + Submissions

- [ ] Add embed tab.
- [ ] Generate iframe snippet.
- [ ] Generate HTML/script snippet.
- [ ] Generate React snippet.
- [ ] Generate Web Component snippet.
- [ ] Add allowed domains per form.
- [ ] Build submissions inbox/detail.
- [ ] Convert/merge submission into CRM records.
- [ ] Add CSV export.

## Phase 10 — AI Preview/Apply

- [ ] Make AI sidebar context-aware per active object.
- [ ] Add CRM Agent selector.
- [ ] Add non-destructive suggestions.
- [ ] Add preview/apply confirmation UI.
- [ ] Log applied AI suggestions as activities.

## Phase 11 — Settings + Future Integration Placeholders

- [ ] CRM settings page.
- [ ] Forms settings page.
- [ ] Webhook UI/data placeholders.
- [ ] Notification email placeholders.
- [ ] File upload storage disabled/future note.
- [ ] Future VPS API comments in services.

## Phase 12 — Polish, Responsive, Regression

- [ ] Match screenshot visually.
- [ ] Check panel heights/spacing against task/doc mode.
- [ ] Check desktop/tablet/mobile behavior.
- [ ] Verify no doc/task mode regressions.
- [ ] Run `npm run build`.
- [ ] Run `npm run lint`.
- [ ] Fix TypeScript errors.
- [ ] Fix obvious accessibility issues.

## Final Acceptance

- [ ] CRM and Forms modules are separate.
- [ ] Every CRM/Form page uses the 3-panel layout.
- [ ] Panel 3 is CRM AI sidebar with CRM Agents.
- [ ] Full CRM pages exist.
- [ ] Full Forms pages exist.
- [ ] Builder supports Build/Style/Logic/Embed/Submissions/Settings.
- [ ] Embed outputs include iframe, HTML/script, React, Web Component.
- [ ] File upload has future VPS TODO and is disabled in production embeds.
- [ ] Webhook delivery has future backend TODO.
- [ ] Allowed domains per form exist.
- [ ] CSV export works.
- [ ] Existing task/doc modes still work.
