# Run from the repository root.
# Creates sibling worktrees for the Models/Tools refactor swarm.

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$repoName = Split-Path $repoRoot -Leaf
$parent = Split-Path $repoRoot -Parent

$worktrees = @(
  @{ Branch = "feature/settings-tools-shell"; Folder = "$repoName-agent-a-tools-shell" },
  @{ Branch = "feature/models-left-panel-refactor"; Folder = "$repoName-agent-b-models-left-panel" },
  @{ Branch = "feature/provider-detail-tabs"; Folder = "$repoName-agent-c-provider-detail-tabs" },
  @{ Branch = "feature/provider-status-connection-models"; Folder = "$repoName-agent-d-status-connection" },
  @{ Branch = "feature/defaults-usage-advanced"; Folder = "$repoName-agent-e-defaults-usage-advanced" },
  @{ Branch = "feature/tools-search-providers"; Folder = "$repoName-agent-f-tools-search-providers" },
  @{ Branch = "feature/settings-css-i18n-cleanup"; Folder = "$repoName-agent-g-css-i18n-cleanup" },
  @{ Branch = "feature/qa-integration"; Folder = "$repoName-agent-qa-integration" }
)

Write-Host "Repo root: $repoRoot"
Write-Host "Worktree parent: $parent"

foreach ($wt in $worktrees) {
  $path = Join-Path $parent $wt.Folder
  $branch = $wt.Branch

  if (Test-Path $path) {
    Write-Host "Skipping existing worktree folder: $path"
    continue
  }

  $branchExists = $false
  git show-ref --verify --quiet "refs/heads/$branch"
  if ($LASTEXITCODE -eq 0) { $branchExists = $true }

  if ($branchExists) {
    Write-Host "Adding existing branch $branch at $path"
    git worktree add $path $branch
  } else {
    Write-Host "Creating branch $branch at $path"
    git worktree add -b $branch $path
  }
}

Write-Host "Done. Run scripts/open-worktrees.ps1 next."
