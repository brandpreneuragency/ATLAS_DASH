#!/usr/bin/env node
/**
 * Minimal workspace linter for Model Monitor.
 * Uses the TypeScript compiler API already present in the workspace.
 * Checks: parseability, explicit `any`, and secret-material hardcoding patterns.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, extname } from "node:path";
import ts from "typescript";

const root = resolve(process.argv[2] ?? ".");
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  "coverage",
  ".turbo",
  ".git",
  "docs",
]);

/** @type {string[]} */
const errors = [];
let fileCount = 0;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    const ext = extname(entry);
    if (ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts") {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} file
 * @param {string} source
 */
function lintFile(file, source) {
  fileCount += 1;
  const rel = relative(process.cwd(), file);
  const kind = file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, kind);

  /**
   * @param {ts.Node} node
   */
  function visit(node) {
    // Explicit TypeScript `any` keyword usages.
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      errors.push(`${rel}:${line + 1}:${character + 1}: explicit \`any\` is forbidden`);
    }

    // as any
    if (
      ts.isAsExpression(node) &&
      node.type.kind === ts.SyntaxKind.AnyKeyword
    ) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      errors.push(`${rel}:${line + 1}:${character + 1}: \`as any\` is forbidden`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sf);

  // Secret-material hardcoding (high-signal only).
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /AKIA[0-9A-Z]{16}/,
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(source)) {
      errors.push(`${rel}: possible secret material matched ${pattern}`);
    }
  }
}

const files = walk(root);
if (files.length === 0) {
  console.error(`lint: no TypeScript files under ${root}`);
  process.exit(1);
}

for (const file of files) {
  lintFile(file, readFileSync(file, "utf8"));
}

if (errors.length > 0) {
  console.error(`lint failed (${errors.length} issue(s) in ${fileCount} file(s)):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`lint ok: ${fileCount} file(s) checked under ${relative(process.cwd(), root) || "."}`);
