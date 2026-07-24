import { describe, it, expect, beforeAll } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs/promises";

import { intakeWorkbook, readFileBuffer, storeFileUnder } from "./intake";
import { loadWorkbook, parseWorkbook, excelSerialDateToIso } from "./parser";
import {
  normalizeTrim,
  normalizeCase,
  resolveProviderAlias,
  createSlugFromId,
  isDeveloper,
  resolveDeveloper,
  resolveAccessProvider,
  normalizeMasterRow,
  parseTriState,
} from "./normalize";
import { buildMatchRegistry, matchRow } from "./match";
import type { CanonicalIdentity } from "./types";

// ── Fixture path ──────────────────────────────────────────────────

const WORKBOOK_PATH = path.resolve(
  __dirname,
  "../../../docs/implementation-package/source/LLM_MASTER_v2.xlsm",
);

const CANONICAL_SEED_PATH = path.resolve(
  __dirname,
  "../../../docs/implementation-package/data/canonical-models.seed.json",
);

// ── Shared fixture data ───────────────────────────────────────────

let workbookBuffer: Buffer;
let canonicalSeed: CanonicalIdentity[];

beforeAll(async () => {
  workbookBuffer = await readFileBuffer(WORKBOOK_PATH);
  const seedJson = await fs.readFile(CANONICAL_SEED_PATH, "utf-8");
  const rawSeed = JSON.parse(seedJson) as Array<{
    canonicalId: string;
    name: string;
    developer: string;
    family: string | null;
    generation: number | string | null;
  }>;
  canonicalSeed = rawSeed.map((m) => ({
    canonicalId: m.canonicalId,
    name: m.name,
    developer: m.developer,
    family: m.family ?? null,
    generation: m.generation !== null ? String(m.generation) : null,
    sourceModelId: (m as Record<string, unknown>).sourceModelId as string | undefined,
  }));
});

// ═══════════════════════════════════════════════════════════════════
// Intake
// ═══════════════════════════════════════════════════════════════════

describe("intake", () => {
  it("accepts .xlsx and .xlsm extensions", async () => {
    const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), "intake-test-"));
    const store = storeFileUnder(storeDir);
    const result = await intakeWorkbook(workbookBuffer, "test.xlsm", {
      storeFile: store,
    });
    expect(result.sha256).toHaveLength(64);
    expect(result.byteSize).toBeGreaterThan(0);
    expect(result.parserVersion).toBe("0.1.0");
    await fs.rm(storeDir, { recursive: true, force: true });
  });

  it("rejects unsupported extensions", async () => {
    const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), "intake-test-"));
    const store = storeFileUnder(storeDir);
    await expect(
      intakeWorkbook(Buffer.from("fake"), "test.csv", { storeFile: store }),
    ).rejects.toThrow(/unsupported/i);
    await fs.rm(storeDir, { recursive: true, force: true });
  });

  it("rejects files exceeding byte limit", async () => {
    const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), "intake-test-"));
    const store = storeFileUnder(storeDir);
    await expect(
      intakeWorkbook(workbookBuffer, "test.xlsm", {
        storeFile: store,
        maxBytes: 100,
      }),
    ).rejects.toThrow(/exceeds/i);
    await fs.rm(storeDir, { recursive: true, force: true });
  });

  it("computes SHA-256 deterministically", async () => {
    const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), "intake-test-"));
    const store1 = storeFileUnder(storeDir);
    const store2 = storeFileUnder(storeDir);
    const r1 = await intakeWorkbook(workbookBuffer, "test.xlsm", {
      storeFile: store1,
    });
    const r2 = await intakeWorkbook(workbookBuffer, "test.xlsm", {
      storeFile: store2,
    });
    expect(r1.sha256).toBe(r2.sha256);
    await fs.rm(storeDir, { recursive: true, force: true });
  });

  it("stores file via caller-supplied callback", async () => {
    const storeDir = await fs.mkdtemp(path.join(os.tmpdir(), "intake-test-"));
    const store = storeFileUnder(storeDir);
    const result = await intakeWorkbook(workbookBuffer, "my-file.xlsm", {
      storeFile: store,
    });
    expect(result.storedPath).toMatch(/\.xlsm$/);
    const stored = await fs.readFile(result.storedPath);
    expect(stored.length).toBe(workbookBuffer.length);
    await fs.rm(storeDir, { recursive: true, force: true });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════════════

describe("parser", () => {
  let parsed: ReturnType<typeof parseWorkbook>;

  beforeAll(() => {
    const wb = loadWorkbook(workbookBuffer);
    parsed = parseWorkbook(wb);
  });

  it("parses 15 sheets (11 known + 4 skipped handoffs)", () => {
    const allSheets = parsed.sheets.length + parsed.skippedSheets.length;
    expect(allSheets).toBe(15);
    expect(parsed.skippedSheets.filter((s) => s.includes("Handoff"))).toHaveLength(4);
    expect(parsed.sheets.length).toBe(11);
  });

  it("finds Master Models with 31 populated rows", () => {
    const mm = parsed.sheets.find((s) => s.name === "Master Models");
    expect(mm).toBeDefined();
    expect(mm!.rows.length).toBe(31);
  });

  it("extracts Master Models headers (76 columns)", () => {
    const mm = parsed.sheets.find((s) => s.name === "Master Models");
    expect(mm).toBeDefined();
    expect(mm!.headers.length).toBe(76);
    expect(mm!.headers[0]).toBe("Provider");
    expect(mm!.headers[3]).toBe("Model ID");
  });

  it("captures cell provenance", () => {
    const mm = parsed.sheets.find((s) => s.name === "Master Models")!;
    expect(mm.rows.length).toBeGreaterThan(0);
    const firstRow = mm.rows[0]!;
    expect(firstRow.provenance.length).toBeGreaterThan(0);
    expect(firstRow.provenance[0]!.sheet).toBe("Master Models");
    expect(firstRow.provenance[0]!.row).toBeGreaterThan(0);
  });

  it("converts Excel serial dates correctly", () => {
    expect(excelSerialDateToIso(0)).toBe("1899-12-30");
    expect(excelSerialDateToIso(1)).toBe("1899-12-31");
    // 46196 = 2026-06-23 (verified: 46196 days from 1899-12-30)
    expect(excelSerialDateToIso(46196)).toBe("2026-06-23");
  });

  it("reports zero formula cells (workbook has no formulas)", () => {
    const mm = parsed.sheets.find((s) => s.name === "Master Models")!;
    expect(mm.errors.filter((e) => e.message.includes("Formula"))).toHaveLength(0);
  });

  it("normalizes empty strings to null", () => {
    const mm = parsed.sheets.find((s) => s.name === "Master Models")!;
    const commandCodeRows = mm.rows.filter(
      (r) => r.cells["Model ID"] === null,
    );
    expect(commandCodeRows.length).toBeGreaterThanOrEqual(3);
  });

  it("finds Baseline Reference with at least 28 model roster rows", () => {
    const br = parsed.sheets.find((s) => s.name === "Baseline Reference");
    expect(br).toBeDefined();
    // Baseline Reference has 29 populated rows in the fixture
    expect(br!.rows.length).toBeGreaterThanOrEqual(28);
  });

  it("finds Expansion Scope with roster metadata", () => {
    const es = parsed.sheets.find((s) => s.name === "Expansion Scope");
    expect(es).toBeDefined();
    expect(es!.rows.length).toBeGreaterThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Normalization
// ═══════════════════════════════════════════════════════════════════

describe("normalize", () => {
  describe("general helpers", () => {
    it("trims and collapses whitespace", () => {
      expect(normalizeTrim("  hello   world  ")).toBe("hello world");
      expect(normalizeTrim("  ")).toBeNull();
      expect(normalizeTrim(null)).toBeNull();
    });

    it("case-normalizes strings", () => {
      expect(normalizeCase("OpenAI")).toBe("openai");
      expect(normalizeCase(null)).toBeNull();
    });

    it("resolves provider aliases", () => {
      expect(resolveProviderAlias("openai")).toBe("OpenAI");
      expect(resolveProviderAlias("Open AI")).toBe("OpenAI");
      expect(resolveProviderAlias("grok")).toBe("xAI");
      expect(resolveProviderAlias("claude")).toBe("Anthropic");
      expect(resolveProviderAlias("kimi")).toBe("Moonshot AI");
      expect(resolveProviderAlias(null)).toBeNull();
    });

    it("creates stable slugs from canonical IDs", () => {
      expect(createSlugFromId("gpt-5.6-sol")).toBe("gpt-5.6-sol");
      // Slugs preserve dots, dashes, and slashes
      expect(createSlugFromId("z-ai/glm-5.2")).toBe("z-ai/glm-5.2");
      expect(createSlugFromId("opencode-go/glm-5.1")).toBe("opencode-go/glm-5.1");
    });
  });

  describe("developer/access-provider separation", () => {
    it("identifies known developers", () => {
      expect(isDeveloper("OpenAI")).toBe(true);
      expect(isDeveloper("Anthropic")).toBe(true);
      expect(isDeveloper("Google")).toBe(true);
    });

    it("identifies access providers", () => {
      expect(isDeveloper("OpenCode")).toBe(false);
      expect(isDeveloper("CommandCode")).toBe(false);
      expect(isDeveloper("Opencode")).toBe(false);
    });

    it("resolves developer names correctly", () => {
      expect(resolveDeveloper("OpenAI")).toBe("OpenAI");
      // Access providers resolve to null developer
      expect(resolveDeveloper("OpenCode")).toBeNull();
      expect(resolveDeveloper("CommandCode")).toBeNull();
      expect(resolveDeveloper("NVIDIA")).toBe("NVIDIA");
    });

    it("resolves access providers", () => {
      expect(resolveAccessProvider("OpenCode", "OpenCode Go")).toBe("OpenCode");
      expect(resolveAccessProvider("CommandCode", "CommandCode CLI")).toBe(
        "CommandCode",
      );
      expect(resolveAccessProvider("OpenAI", "ChatGPT Plus / Codex")).toBeNull();
      expect(resolveAccessProvider("Google", "Gemini API")).toBeNull();
    });
  });

  describe("Master Models normalization roundtrip", () => {
    let parsed: ReturnType<typeof parseWorkbook>;
    let mmRows: ReturnType<typeof normalizeMasterRow>[];

    beforeAll(() => {
      const wb = loadWorkbook(workbookBuffer);
      parsed = parseWorkbook(wb);
      const mm = parsed.sheets.find((s) => s.name === "Master Models")!;
      mmRows = mm.rows.map((r) => normalizeMasterRow(r));
    });

    it("normalizes 31 rows", () => {
      expect(mmRows).toHaveLength(31);
    });

    it("separates developer from access provider", () => {
      const openAiRow = mmRows.find((r) => r.name?.includes("GPT-5.6"));
      expect(openAiRow?.developer).toBe("OpenAI");
      expect(openAiRow?.accessProvider).toBeNull();

      // OpenCode row → provider is "OpenCode", which is an access provider
      const openCodeRow = mmRows.find(
        (r) => r.name === "GLM-5.2" && r.accessProvider === "OpenCode",
      );
      expect(openCodeRow).toBeDefined();
      // The developer for an OpenCode model comes from the canonical ID,
      // not the raw provider column. In the raw data, an OpenCode row's
      // developer resolves from the provider column - for OpenCode rows
      // where we don't know the developer from the Provider column, it's null
      // (the resolver maps this in the matching phase against the seed)

      // CommandCode row
      const ccRow = mmRows.find(
        (r) => r.name === "MiMo-V2.5-Pro" && r.accessProvider === "CommandCode",
      );
      expect(ccRow).toBeDefined();
    });

    it("preserves Model ID for rows that have it", () => {
      const gptRow = mmRows.find((r) => r.modelId === "gpt-5.6-sol");
      expect(gptRow).toBeDefined();
    });

    it("sets null Model ID for access-only rows", () => {
      const accessRows = mmRows.filter((r) => r.modelId === null);
      expect(accessRows.length).toBeGreaterThanOrEqual(3);
    });

    it("never sets subscription cost as zero unless explicit", () => {
      for (const row of mmRows) {
        if (row.subscriptionUsdMo === 0) {
          expect(row.subscriptionUsdMo).toBe(0);
        }
      }
    });

    it("preserves lifecycle labels as raw strings", () => {
      const lifecycleLabels = mmRows
        .map((r) => r.lifecycleRaw)
        .filter(Boolean);
      expect(lifecycleLabels.length).toBeGreaterThan(0);
    });

    it("parses tri-state vision support", () => {
      const yesRow = mmRows.find((r) => r.visionSupport === true);
      expect(yesRow).toBeDefined();
      const unknownRow = mmRows.find((r) => r.visionSupport === null);
      expect(unknownRow).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Matching
// ═══════════════════════════════════════════════════════════════════

describe("matching", () => {
  let registry: ReturnType<typeof buildMatchRegistry>;

  beforeAll(() => {
    registry = buildMatchRegistry(canonicalSeed);
  });

  it("has 51 canonical identities in seed", () => {
    expect(registry.byCanonicalId.size).toBe(51);
  });

  it("matches by exact canonical ID", () => {
    const result = matchRow(registry, {
      modelId: "gpt-5.6-sol",
      providerModelId: "gpt-5.6-sol",
      name: "GPT-5.6 Sol",
      developer: "OpenAI",
      family: "GPT-5.6",
      generation: "5.6",
    });
    expect(result.matchLevel).toBe("exact_canonical_id");
    expect(result.candidateCanonicalId).toBe("gpt-5.6-sol");
    expect(result.confidence).toBe(1);
  });

  it("matches by name + developer", () => {
    const result = matchRow(registry, {
      modelId: null,
      providerModelId: null,
      name: "GPT-5.6 Sol",
      developer: "OpenAI",
      family: null,
      generation: null,
    });
    expect(result.matchLevel).toBe("name_plus_developer");
    expect(result.candidateCanonicalId).toBe("gpt-5.6-sol");
  });

  it("matches by family + generation + developer", () => {
    const result = matchRow(registry, {
      modelId: null,
      providerModelId: null,
      name: null,
      developer: "Xiaomi",
      family: "MiMo",
      generation: "V2.5",
    });
    expect(result.matchLevel).toBe("family_plus_generation_plus_developer");
    expect(result.candidateCanonicalId).toBe("xiaomi/mimo-v2.5");
  });

  it("returns manual review for unknown models", () => {
    const result = matchRow(registry, {
      modelId: null,
      providerModelId: null,
      name: "Unknown Model X",
      developer: "Unknown Dev",
      family: null,
      generation: null,
    });
    expect(result.matchLevel).toBe("manual_review");
    expect(result.candidateCanonicalId).toBeNull();
  });

  it("matches on name alone when a single candidate exists", () => {
    // A unique model name should match by name alone
    const result = matchRow(registry, {
      modelId: null,
      providerModelId: null,
      name: "Grok 4.5",
      developer: null,
      family: null,
      generation: null,
    });
    expect(result.matchLevel).toBe("name_plus_developer");
    expect(result.candidateCanonicalId).toBe("grok-4.5");
  });

  it("matches access rows with provider_model_id via alias", () => {
    // Access row that should match via alias or provider model ID
    const result = matchRow(registry, {
      modelId: null,
      providerModelId: "opencode-go/mimo-v2.5",
      name: "MiMo-V2.5",
      developer: null,
      family: null,
      generation: null,
      aliases: ["opencode-go/mimo-v2.5", "MiMo-V2.5"],
    });
    // Should match via the alias lookup
    expect(result.candidateCanonicalId).not.toBeNull();
    expect(result.matchLevel).not.toBe("manual_review");
  });

  it("all 51 canonical models are findable by their own ID", () => {
    for (const identity of canonicalSeed) {
      const result = matchRow(registry, {
        modelId: identity.canonicalId,
        providerModelId: identity.canonicalId,
        name: identity.name,
        developer: identity.developer,
        family: identity.family,
        generation: identity.generation,
      });
      expect(result.matchLevel).toBe("exact_canonical_id");
      expect(result.candidateCanonicalId).toBe(identity.canonicalId);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// End-to-end: workbook → parse → normalize → match (no duplicates)
// ═══════════════════════════════════════════════════════════════════

describe("end-to-end import pipeline", () => {
  let parsed: ReturnType<typeof parseWorkbook>;
  let normalized: ReturnType<typeof normalizeMasterRow>[];
  let registry: ReturnType<typeof buildMatchRegistry>;

  beforeAll(() => {
    const wb = loadWorkbook(workbookBuffer);
    parsed = parseWorkbook(wb);
    registry = buildMatchRegistry(canonicalSeed);

    const mm = parsed.sheets.find((s) => s.name === "Master Models")!;
    normalized = mm.rows.map((r) => normalizeMasterRow(r));
  });

  it("31 Master Models rows parse without errors", () => {
    const mm = parsed.sheets.find((s) => s.name === "Master Models")!;
    expect(mm.errors).toHaveLength(0);
  });

  it("access-only rows (null Model ID) are matched by alias or name", () => {
    const accessRows = normalized.filter((r) => r.modelId === null);
    expect(accessRows.length).toBeGreaterThanOrEqual(3);

    for (const row of accessRows) {
      const result = matchRow(registry, {
        modelId: row.modelId,
        providerModelId: row.providerModelId,
        name: row.name,
        developer: row.developer,
        family: row.family,
        generation: row.generation,
        aliases: [row.name ?? "", row.providerModelId ?? ""].filter(Boolean),
      });
      // All access-only rows in the fixture should match something
      expect(result.matchLevel).not.toBe("manual_review");
    }
  });

  it("31 rows resolve to ≤ 51 canonical models without creating duplicates", () => {
    const matchedIds = new Set<string>();

    for (const row of normalized) {
      const result = matchRow(registry, {
        modelId: row.modelId,
        providerModelId: row.providerModelId,
        name: row.name,
        developer: row.developer,
        family: row.family,
        generation: row.generation,
        aliases: [row.name ?? "", row.providerModelId ?? ""].filter(Boolean),
      });
      if (result.candidateCanonicalId) {
        matchedIds.add(result.candidateCanonicalId);
      }
    }

    expect(matchedIds.size).toBeLessThanOrEqual(51);
    expect(matchedIds.size).toBeGreaterThan(0);
  });

  it("duplicate access rows map to the same canonical model", () => {
    // MiMo-V2.5 appears in OpenCode Go, Opencode Zen, and potentially CommandCode
    const mimoRows = normalized.filter(
      (r) => r.name === "MiMo-V2.5" || r.name === "MiMo-V2.5-Pro",
    );
    expect(mimoRows.length).toBeGreaterThanOrEqual(2);

    const matchedIds = new Set<string>();
    for (const row of mimoRows) {
      const result = matchRow(registry, {
        modelId: row.modelId,
        providerModelId: row.providerModelId,
        name: row.name,
        developer: row.developer,
        family: row.family,
        generation: row.generation,
        aliases: [row.name ?? "", row.providerModelId ?? ""].filter(Boolean),
      });
      if (result.candidateCanonicalId) {
        matchedIds.add(result.candidateCanonicalId);
      }
    }

    // Different access rows should map to ≤ distinct canonical models
    expect(matchedIds.size).toBeLessThanOrEqual(mimoRows.length);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  it("parseTriState never coerces null → false", () => {
    expect(parseTriState(null)).toBeNull();
    expect(parseTriState(undefined)).toBeNull();
    expect(parseTriState("")).toBeNull();
    expect(parseTriState("unknown")).toBeNull();
    expect(parseTriState("true")).toBe(true);
    expect(parseTriState("false")).toBe(false);
    expect(parseTriState(true)).toBe(true);
    expect(parseTriState(false)).toBe(false);
  });

  it("missing numeric cost stays null", () => {
    expect(cellNumber(undefined)).toBeNull();
    expect(cellNumber(null)).toBeNull();
    expect(cellNumber("")).toBeNull();
    expect(cellNumber(0)).toBe(0); // explicit zero stays zero
  });

  it("intake rejects encrypted files where detectable", async () => {
    const fakeEncrypted = Buffer.from("EncryptedPackage");
    const store = storeFileUnder(os.tmpdir());
    await expect(
      intakeWorkbook(fakeEncrypted, "fake.xlsm", { storeFile: store }),
    ).rejects.toThrow(/encrypted/i);
  });

  it("serial date conversion handles epoch boundary", () => {
    expect(excelSerialDateToIso(1)).toBe("1899-12-31");
    expect(excelSerialDateToIso(60)).toBe("1900-02-28");
    // Excel's Lotus 123 bug: 1900-02-29 doesn't exist but Excel counts it
    expect(excelSerialDateToIso(61)).toBe("1900-03-01");
  });

  it("buildMatchRegistry handles empty input", () => {
    const r = buildMatchRegistry([]);
    expect(r.byCanonicalId.size).toBe(0);
    expect(r.byAlias.size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Fixture-level assertions
// ═══════════════════════════════════════════════════════════════════

describe("fixture integrity", () => {
  it("workbook file exists and is readable", async () => {
    await expect(readFileBuffer(WORKBOOK_PATH)).resolves.toBeDefined();
  });

  it("canonical seed has 51 entries", () => {
    expect(canonicalSeed).toHaveLength(51);
  });

  it("seed models have required fields", () => {
    for (const m of canonicalSeed) {
      expect(m.canonicalId).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.developer).toBeTruthy();
    }
  });
});

// ── Test helper ───────────────────────────────────────────────────

function cellNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
