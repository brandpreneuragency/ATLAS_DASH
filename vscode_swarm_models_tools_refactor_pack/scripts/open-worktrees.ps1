# Run from the repository root after create-worktrees.ps1.
# Opens each worktree in a separate VS Code window.

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
    Write-Host "Opening $path"
    code $path
  } else {
    Write-Host "Missing worktree: $path"
  }
}
