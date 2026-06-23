#!/usr/bin/env node
// scripts/version-bump.mjs
//
// Bump the version of TABS in lockstep across:
//   - package.json
//   - src-tauri/tauri.conf.json
// then commit the change and create an annotated git tag `v<version>`.
//
// Usage:
//   node scripts/version-bump.mjs <new-version>
//   npm run version:bump -- 1.0.2
//
// The version must be a valid semver triple (e.g. 1.2.3 or 1.2.3-beta.1).

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function die(msg) {
  console.error(`\u274c ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`\u2705 ${msg}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJSON(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const newVersion = (process.argv[2] ?? '').trim();
if (!newVersion) die('Missing version. Usage: npm run version:bump -- 1.2.3');

// Accept bare semver (1.2.3) and prefixed (v1.2.3). Reject anything weird.
const semverLike = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const normalized = newVersion.startsWith('v') ? newVersion.slice(1) : newVersion;
if (!semverLike.test(normalized)) {
  die(
    `Invalid version "${newVersion}". Expected semver like 1.2.3 or 1.2.3-beta.1.`
  );
}

const pkgPath = resolve(ROOT, 'package.json');
const tauriPath = resolve(ROOT, 'src-tauri/tauri.conf.json');

const pkg = readJSON(pkgPath);
const tauri = readJSON(tauriPath);

const currentPkg = pkg.version;
const currentTauri = tauri.version;

if (currentPkg !== currentTauri) {
  die(
    `Version mismatch between package.json (${currentPkg}) and ` +
      `src-tauri/tauri.conf.json (${currentTauri}). Fix manually before bumping.`
  );
}

if (currentPkg === normalized) {
  die(`Version is already ${currentPkg}. Nothing to do.`);
}

// Naive semver compare is fine for our needs (no pre-release build meta).
function compareVersions(a, b) {
  const [aMain, aPre = ''] = a.split('-');
  const [bMain, bPre = ''] = b.split('-');
  const aNums = aMain.split('.').map(Number);
  const bNums = bMain.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((aNums[i] ?? 0) > (bNums[i] ?? 0)) return 1;
    if ((aNums[i] ?? 0) < (bNums[i] ?? 0)) return -1;
  }
  // Main versions equal: a pre-release is lower than the same without.
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (aPre < bPre) return -1;
  if (aPre > bPre) return 1;
  return 0;
}

if (compareVersions(normalized, currentPkg) <= 0) {
  die(
    `New version ${normalized} is not greater than current version ${currentPkg}.`
  );
}

// Verify git is clean so we don't accidentally mix in unrelated changes.
try {
  const status = execSync('git status --porcelain', {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (status.trim().length > 0) {
    die(
      'Working tree has uncommitted changes. Commit or stash them first.\n' +
        status
    );
  }
} catch (e) {
  die('git is not available or this is not a git repository.');
}

// Apply the bump.
pkg.version = normalized;
tauri.version = normalized;
writeJSON(pkgPath, pkg);
writeJSON(tauriPath, tauri);
ok(`Bumped version: ${currentPkg} -> ${normalized}`);

// Commit + tag.
run('git add package.json src-tauri/tauri.conf.json');
run(`git commit -m "Bump version to ${normalized}"`);
run(`git tag -a v${normalized} -m "Release v${normalized}"`);
ok(`Created commit and tag v${normalized}`);

console.log('');
console.log('Next step:');
console.log(`  git push origin main --tags`);
console.log('');
console.log('Then publish the draft release at:');
console.log('  https://github.com/brandpreneuragency/TABS/releases');
