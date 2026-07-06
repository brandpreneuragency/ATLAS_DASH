# Traceability Matrix

| Original phase | New swarm owner | Branch | Notes |
|---|---|---|---|
| Main implementation direction | Orchestrator | main | Preserves architecture constraints and prevents foreign dashboard layout. |
| Phase 1 — Add real Tools settings page | Agent A | `feature/settings-tools-shell` | Must be merged before detailed Tools work. |
| Phase 2 — Refactor ModelsSection left panel | Agent B | `feature/models-left-panel-refactor` | Should avoid touching ModelsContent unless required. |
| Phase 3 — Replace accordion detail with tabbed provider detail | Agent C | `feature/provider-detail-tabs` | Creates new `modelProviders/*` components. |
| Phase 4 — Improve provider status model | Agent D | `feature/provider-status-connection-models` | Touches types/store/status badge. Merge after C if conflicts occur. |
| Phase 5 — Connection tab | Agent D | `feature/provider-status-connection-models` | Separates test, sync, and connected-ready behavior. |
| Phase 6 — Models tab | Agent D | `feature/provider-status-connection-models` | Reuses ModelSwitch and custom model support. |
| Phase 7 — Defaults tab | Agent E | `feature/defaults-usage-advanced` | Uses `db.settings` first. No new Dexie table for defaults. |
| Phase 8 — Usage tab | Agent E | `feature/defaults-usage-advanced` | Honest Unknown values unless token/pricing exists. |
| Phase 9 — Advanced tab | Agent E | `feature/defaults-usage-advanced` | Delete requires confirmation. No raw keys. |
| Phase 10 — Tools page | Agent F | `feature/tools-search-providers` | Uses existing `searchConfig` and `saveSearchConfig`. |
| Phase 11 — CSS rules | Agent G | `feature/settings-css-i18n-cleanup` | Final cleanup only after functionality lands. |
| Final acceptance | QA + Merge Agent | main | Typecheck/build/lint/manual regression. |
