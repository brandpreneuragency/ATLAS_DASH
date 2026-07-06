# Optional helper for the orchestrator.
# Run from the main repository root only after reviewing each branch diff.

$ErrorActionPreference = "Stop"

$branches = @(
  "feature/settings-tools-shell",
  "feature/models-left-panel-refactor",
  "feature/provider-detail-tabs",
  "feature/tools-search-providers",
  "feature/provider-status-connection-models",
  "feature/defaults-usage-advanced",
  "feature/settings-css-i18n-cleanup",
  "feature/qa-integration"
)

foreach ($branch in $branches) {
  Write-Host ""
  Write-Host "========================================"
  Write-Host "Reviewing $branch"
  Write-Host "========================================"

  git status --short
  if ((git status --porcelain).Length -gt 0) {
    throw "Working tree is not clean. Commit or stash before merging $branch."
  }

  git diff --stat "HEAD..$branch"
  git diff --name-only "HEAD..$branch"

  $answer = Read-Host "Merge $branch now? Type YES to continue"
  if ($answer -ne "YES") {
    Write-Host "Skipping $branch"
    continue
  }

  git merge --no-ff $branch

  if (Test-Path package.json) {
    npm run typecheck --if-present
    npm run lint --if-present
    npm run build --if-present
    npm test --if-present
  }
}
