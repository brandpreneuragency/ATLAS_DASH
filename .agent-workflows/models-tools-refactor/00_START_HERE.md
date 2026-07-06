# VS Code Multi-Agent Worktree Package

Purpose: restructure the uploaded Models/Tools settings refactor into a safe VS Code swarm workflow.

This package does **not** contain app source-code replacements. It contains the exact orchestration files, agent prompts, file boundaries, checklists, and PowerShell helpers you can place inside your repo and use with VS Code/Codex/Cursor/Copilot agents.

## Recommended operating model

Use one orchestrator window and one VS Code window per branch/worktree.

```txt
main repo window
  Orchestrator + merge review

../<repo>-agent-a-tools-shell
  Agent A: Settings Tools tab shell

../<repo>-agent-b-models-left-panel
  Agent B: Models left rail cleanup

../<repo>-agent-c-provider-detail-tabs
  Agent C: Provider detail tab UX

../<repo>-agent-d-status-connection
  Agent D: provider status + connection behavior

../<repo>-agent-e-defaults-usage-advanced
  Agent E: defaults, usage, advanced tabs

../<repo>-agent-f-tools-search-providers
  Agent F: Tools page search provider settings

../<repo>-agent-g-css-i18n-cleanup
  Agent G: styling, i18n, cleanup
```

## Exact order

### Step 0 — Put this package in the repo

Copy this whole folder into your project root as:

```txt
.agent-workflows/models-tools-refactor/
```

Do not copy these files into `src/`.

### Step 1 — Start orchestrator in the main repo

Open your main project folder in VS Code.

Give your main/orchestrator agent this file:

```txt
agent-prompts/00_ORCHESTRATOR_MASTER_PROMPT.md
```

Ask it to inspect the repo and create/update:

```txt
docs/settings-models-tools-refactor-audit.md
```

### Step 2 — Create worktrees

From the repo root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .agent-workflows/models-tools-refactor/scripts/create-worktrees.ps1
```

This creates one sibling folder per agent branch.

### Step 3 — Open worktrees in VS Code

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .agent-workflows/models-tools-refactor/scripts/open-worktrees.ps1
```

### Step 4 — Run agents by wave

Use the prompts in `agent-prompts/`.

Run them in this order:

```txt
Wave 0:
00_ORCHESTRATOR_MASTER_PROMPT.md

Wave 1:
01_AGENT_A_TOOLS_TAB_SHELL.md

Merge Agent A into main.

Wave 2, parallel if desired:
02_AGENT_B_MODELS_LEFT_PANEL.md
03_AGENT_C_PROVIDER_DETAIL_TABS.md
06_AGENT_F_TOOLS_SEARCH_PROVIDERS.md

Merge B, C, and F carefully.

Wave 3:
04_AGENT_D_STATUS_CONNECTION_MODELS.md
05_AGENT_E_DEFAULTS_USAGE_ADVANCED.md

Merge D and E carefully.

Wave 4:
07_AGENT_G_CSS_I18N_CLEANUP.md
08_QA_AGENT.md
09_MERGE_AGENT.md
```

### Step 5 — Validate

Use:

```txt
checklists/ACCEPTANCE_CHECKLIST.md
checklists/MERGE_REVIEW_CHECKLIST.md
checklists/REGRESSION_CHECKLIST.md
```

Run whatever exists in your repo:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

If a command does not exist, do not invent it. Use the closest existing project check.
