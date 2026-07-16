#!/usr/bin/env node
// Build a Tauri static updater manifest (latest.json) from the last release bundle.
//
// Looks for the Windows NSIS installer + .sig under:
//   src-tauri/target/release/bundle/nsis/
//
// Writes:
//   src-tauri/target/release/latest.json
//
// The download URL defaults to:
//   https://github.com/brandpreneuragency/TABS/releases/download/v{version}/{filename}
// Override with:
//   TABS_RELEASE_BASE_URL=https://github.com/org/repo/releases/download

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const tauri = JSON.parse(
  readFileSync(resolve(ROOT, 'src-tauri/tauri.conf.json'), 'utf8')
);
const version = tauri.version;
const productName = tauri.productName || 'TABS';

const nsisDir = resolve(ROOT, 'src-tauri/target/release/bundle/nsis');
if (!existsSync(nsisDir)) {
  console.error(`No NSIS bundle folder found at:\n  ${nsisDir}\nRun a signed build first.`);
  process.exit(1);
}

const files = readdirSync(nsisDir);
// Prefer setup.exe (NSIS installer), then any .exe that has a matching .sig
const exe =
  files.find((f) => f.toLowerCase().endsWith('-setup.exe')) ||
  files.find((f) => f.toLowerCase().endsWith('.exe') && files.includes(`${f}.sig`));

if (!exe) {
  console.error(`No signed NSIS installer found in ${nsisDir}`);
  console.error('Files:', files.join(', ') || '(empty)');
  process.exit(1);
}

const sigName = `${exe}.sig`;
const sigPath = join(nsisDir, sigName);
if (!existsSync(sigPath)) {
  console.error(`Missing signature file: ${sigPath}`);
  console.error('Did you set TAURI_SIGNING_PRIVATE_KEY and createUpdaterArtifacts?');
  process.exit(1);
}

const signature = readFileSync(sigPath, 'utf8').trim();
const base =
  (process.env.TABS_RELEASE_BASE_URL ||
    `https://github.com/brandpreneuragency/TABS/releases/download/v${version}`
  ).replace(/\/$/, '');

const url = `${base}/${exe}`;
const manifest = {
  version,
  notes: `${productName} ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url,
    },
  },
};

const outDir = resolve(ROOT, 'src-tauri/target/release');
const outPath = join(outDir, 'latest.json');
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log('Wrote updater manifest:');
console.log(`  ${outPath}`);
console.log('');
console.log('Upload these to the GitHub Release (tag v' + version + '):');
console.log(`  1. ${join(nsisDir, exe)}`);
console.log(`  2. ${sigPath}`);
console.log(`  3. ${outPath}  (must be named latest.json on the release)`);
console.log('');
console.log('Expected download URL in latest.json:');
console.log(`  ${url}`);
