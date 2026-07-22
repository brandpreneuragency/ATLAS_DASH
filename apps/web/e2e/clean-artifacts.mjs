import { rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const successOnly = process.argv.includes("--success-only");
const force = process.argv.includes("--force");

// When invoked after a successful suite, remove local diagnostics.
// On failure, leave Playwright traces/screenshots/reports for inspection.
if (successOnly || force) {
  for (const dir of ["test-results", "playwright-report", "blob-report", "coverage"]) {
    const full = path.join(webRoot, dir);
    if (existsSync(full)) {
      rmSync(full, { recursive: true, force: true });
    }
  }
  console.log("e2e clean-artifacts: removed generated Playwright/coverage dirs");
} else {
  console.log("e2e clean-artifacts: skipped (preserve diagnostics unless --success-only/--force)");
}
