# Build a signed TABS installer for auto-update.
#
# Prerequisites (one-time):
#   Private key:  $HOME\.tauri\tabs.key
#   Password:     $HOME\.tauri\tabs.key.password  (one line)
#
# Usage (from repo root):
#   .\scripts\build-signed.ps1
#   .\scripts\build-signed.ps1 -Version 1.1.3
#
# After success, also writes:
#   src-tauri/target/release/latest.json

param(
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$KeyPath = Join-Path $env:USERPROFILE ".tauri\tabs.key"
$PasswordPath = Join-Path $env:USERPROFILE ".tauri\tabs.key.password"

if (-not (Test-Path $KeyPath)) {
  Write-Error "Missing private key: $KeyPath"
}

if ($Version) {
  node -e @"
const fs = require('fs');
const v = process.argv[1];
for (const p of ['package.json', 'src-tauri/tauri.conf.json']) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = v;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}
console.log('Version set to ' + v);
"@ $Version
}

$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content $KeyPath -Raw).Trim()
if (Test-Path $PasswordPath) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content $PasswordPath -Raw).Trim()
} else {
  Write-Warning "No password file at $PasswordPath. Set TAURI_SIGNING_PRIVATE_KEY_PASSWORD if your key has a password."
}

Write-Host "Building signed release..."
npm run tauri:build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node (Join-Path $PSScriptRoot "make-latest-json.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done."
Write-Host "  1. Create GitHub Release tag vX.Y.Z"
Write-Host "  2. Upload installer + .sig + latest.json"
Write-Host "  3. Install this build once on your PC (signed base)"
Write-Host "  4. Later releases auto-update via latest.json"
