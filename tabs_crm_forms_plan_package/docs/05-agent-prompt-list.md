# Agent Prompt List

Run these prompts sequentially. Do not skip Agent 00.

- `00-master-orchestrator.md` — Agent 00 — Master Orchestrator
- `01-layout-shell-and-sidebar.md` — Agent 01 — Layout Shell + Sidebar Modules
- `02-crm-ai-sidebar.md` — Agent 02 — CRM AI Sidebar
- `03-types-stores-services-seed.md` — Agent 03 — Types, Stores, Services, Seed Data
- `04-crm-dashboard.md` — Agent 04 — CRM Dashboard UI
- `05-leads-contacts-companies.md` — Agent 05 — Leads, Contacts, Companies
- `06-pipeline.md` — Agent 06 — CRM Pipeline
- `07-forms-dashboard-list.md` — Agent 07 — Forms Dashboard + Forms List
- `08-form-builder-build-tab.md` — Agent 08 — Form Builder Build Tab
- `09-form-style-logic-tabs.md` — Agent 09 — Form Style + Logic Tabs
- `10-embed-submissions-export.md` — Agent 10 — Embed Output + Submissions + CSV Export
- `11-settings-webhooks-notifications.md` — Agent 11 — CRM/Forms Settings + Webhook/Notification Placeholders
- `12-ai-preview-apply.md` — Agent 12 — AI Context + Preview/Apply Actions
- `13-responsive-polish-regression.md` — Agent 13 — Responsive Polish + Regression QA
- `14-final-review.md` — Agent 14 — Final Review and Hardening

## Recommended Agent Assignment

| Agent | Task | Reasoning | Token load |
|---|---|---:|---:|
| 00 | repo audit/orchestration | High | Medium |
| 01 | layout shell/sidebar | High | Medium |
| 02 | CRM AI sidebar | Medium | Medium |
| 03 | types/stores/services | High | High |
| 04 | CRM dashboard | Medium | Medium |
| 05 | leads/contacts/companies | High | High |
| 06 | pipeline | Medium | Medium |
| 07 | forms dashboard/list | Medium | Medium |
| 08 | builder build tab | High | High |
| 09 | style/logic tabs | High | High |
| 10 | embed/submissions/export | High | High |
| 11 | settings/placeholders | Medium | Medium |
| 12 | AI preview/apply | High | Medium |
| 13 | responsive polish/regression | Medium | High |
| 14 | final review | High | Medium |

Use stronger reasoning models for Agents 00, 01, 03, 05, 08, 09, 10, 12, and 14.
