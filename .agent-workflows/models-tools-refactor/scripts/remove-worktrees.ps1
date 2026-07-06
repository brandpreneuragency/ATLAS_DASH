# Cleanup helper. Run only after everything is merged and you no longer need the worktree folders.
# Run from the repository root.

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$repoName = Split-Path $repoRoot -Leaf
$parent = Split-Path $repoRoot -Parent

$folders = @(
  "$repoName-agent-a-tools-shell",
  "$repoName-agent-b-models-left-panel",
  "$repoName-agent-c-provider-detail-tabs",
  "$repoName-agent-d-status-connection",
  "$repoName-agent-e-defaults-usage-advanced",
  "$repoName-agent-f-tools-search-providers",
  "$repoName-agent-g-css-i18n-cleanup",
  "$repoName-agent-qa-integration"
)

foreach ($folder in $folders) {
  $path = Join-Path $parent $folder
  if (Test-Path $path) {
    Write-Host "Removing worktree $path"
    git worktree remove $path
  }
}

git worktree prune
Write-Host "Done."
