# What To Do With Each File

| File | What to do with it |
|---|---|
| `00_START_HERE.md` | Read first. This is the full workflow order. |
| `01_FILE_INSTRUCTIONS.md` | Use as the package inventory. Keep it in the package. |
| `agent-prompts/00_ORCHESTRATOR_MASTER_PROMPT.md` | Paste into the main repo agent. It coordinates everything and performs final merge decisions. |
| `agent-prompts/01_AGENT_A_TOOLS_TAB_SHELL.md` | Paste into the agent working on branch `feature/settings-tools-shell`. It adds the Settings → Tools tab shell. |
| `agent-prompts/02_AGENT_B_MODELS_LEFT_PANEL.md` | Paste into the agent working on branch `feature/models-left-panel-refactor`. It cleans the Models left panel. |
| `agent-prompts/03_AGENT_C_PROVIDER_DETAIL_TABS.md` | Paste into the agent working on branch `feature/provider-detail-tabs`. It creates the selected-provider center panel with tabs. |
| `agent-prompts/04_AGENT_D_STATUS_CONNECTION_MODELS.md` | Paste into the agent working on branch `feature/provider-status-connection-models`. It improves provider status, connection, sync, and models behavior. |
| `agent-prompts/05_AGENT_E_DEFAULTS_USAGE_ADVANCED.md` | Paste into the agent working on branch `feature/defaults-usage-advanced`. It adds Defaults, Usage, and Advanced tab behavior. |
| `agent-prompts/06_AGENT_F_TOOLS_SEARCH_PROVIDERS.md` | Paste into the agent working on branch `feature/tools-search-providers`. It moves Exa/Tavily/Firecrawl/Brave into Tools. |
| `agent-prompts/07_AGENT_G_CSS_I18N_CLEANUP.md` | Paste into the cleanup agent after functional work is merged. It handles styling, i18n consistency, and dead-code cleanup. |
| `agent-prompts/08_QA_AGENT.md` | Paste into a review-only QA agent. It should inspect, not blindly edit. |
| `agent-prompts/09_MERGE_AGENT.md` | Paste into the orchestrator after agent branches are ready. It guides merge order and conflict handling. |
| `checklists/ACCEPTANCE_CHECKLIST.md` | Use before final approval. Every item should pass or be explicitly deferred. |
| `checklists/MERGE_REVIEW_CHECKLIST.md` | Use after each branch merge. Prevents hidden regressions. |
| `checklists/REGRESSION_CHECKLIST.md` | Use for manual app testing in Settings → Models and Settings → Tools. |
| `reference/source_plan_from_user.md` | Your original plan. Keep it for traceability. Do not paste it directly to every agent unless needed. |
| `reference/TRACEABILITY_MATRIX.md` | Shows how your original phases map to agent branches. |
| `scripts/create-worktrees.ps1` | Run from repo root. Creates sibling worktrees/branches. |
| `scripts/open-worktrees.ps1` | Run from repo root after creating worktrees. Opens each in VS Code. |
| `scripts/merge-branches.ps1` | Optional helper for the orchestrator. Review diffs before running merges. |
| `scripts/remove-worktrees.ps1` | Cleanup helper after the work is merged and branches are no longer needed. |

## Where to keep this folder

Recommended location inside your repo:

```txt
.agent-workflows/models-tools-refactor/
```

Do not import any file in this package from app code.
