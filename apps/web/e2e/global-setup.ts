import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const cleanupScript = path.resolve(
  repoRoot,
  "packages/database/src/cleanup-test-models.ts",
);

function runDbCleanup(label: string) {
  const output = execFileSync(
    "pnpm",
    ["--filter", "@model-monitor/database", "exec", "tsx", cleanupScript],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    },
  );
  console.log(`[e2e ${label}] ${output.trim()}`);
}

/** Ensure prior fixture residue does not affect seed integrity. Never deletes failure diagnostics. */
export default function globalSetup() {
  runDbCleanup("globalSetup");
}
