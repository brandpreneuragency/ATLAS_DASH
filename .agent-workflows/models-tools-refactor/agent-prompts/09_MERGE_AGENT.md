# Merge Agent Prompt — Branch Integration

You are the merge/integration agent in the main repo.

Your job is to merge worktree branches in the safest order, inspect diffs, resolve conflicts, and run checks.

## Branch merge order

```txt
1. feature/settings-tools-shell
2. feature/models-left-panel-refactor
3. feature/provider-detail-tabs
4. feature/tools-search-providers
5. feature/provider-status-connection-models
6. feature/defaults-usage-advanced
7. feature/settings-css-i18n-cleanup
8. feature/qa-integration, if used
```

## Before each merge

Run:

```bash
git status
git diff --stat main..BRANCH_NAME
git diff --name-only main..BRANCH_NAME
```

Read changed files before merging.

## Merge command

```bash
git merge --no-ff BRANCH_NAME
```

If there are conflicts:

1. Preserve current Settings architecture.
2. Preserve newer tabbed ProviderDetailPanel structure over old accordion center UX.
3. Preserve ToolsSection search provider management over web providers in Models.
4. Preserve richer ProviderStatus values.
5. Preserve existing secureStorage/Dexie/Zustand patterns.
6. Do not accept unrelated formatting churn.

## After each merge

Run available checks:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

If one command does not exist, note it and continue with available checks.

## Final manual verification

1. Open Settings → Models.
2. Confirm left panel shows AI/model providers only.
3. Confirm center panel shows selected provider details.
4. Confirm Connection, Models, Defaults, Usage, Advanced tabs exist.
5. Confirm Settings → Tools exists.
6. Confirm Tavily, Exa, Firecrawl, Brave are under Tools.
7. Confirm right Settings AI sidebar still appears.
8. Confirm provider add, key save, test connection, sync models, custom model add, model enable/disable, defaults, delete confirmation.

## Output after each merge

```md
## Merge result
- Branch:
- Changed files:
- Conflicts:
- Conflict decisions:
- Checks run:
- New issues:
```

## Final output

```md
# Final Integration Report

## Branches merged
- 

## Validation commands
- 

## Manual acceptance
- 

## Remaining risks
- 

## Recommended next task
- 
```
