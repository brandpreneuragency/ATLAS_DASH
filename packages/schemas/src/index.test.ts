import { describe, expect, it } from "vitest";
import {
  modelWriteSchema,
  subscriptionWriteSchema,
  errorSchema,
  recordStatusSchema,
  modelListQuerySchema,
  modelScoreWriteSchema,
  formatScoreDisplay,
  formatCapabilityDisplay,
  normalizeAlias,
  parseTriState,
  parseSortParam,
  planAliasMerge,
  planAccessMerge,
  accessMergeKey,
} from "./index";

describe("modelWriteSchema", () => {
  it("accepts a minimal valid model write payload", () => {
    const parsed = modelWriteSchema.parse({
      canonicalId: "openai:gpt-4.1",
      name: "GPT-4.1",
      developerId: "11111111-1111-1111-1111-111111111111",
    });

    expect(parsed.lifecycle).toBe("unknown");
    expect(parsed.needsRecheck).toBe(true);
    expect(parsed.family).toBeUndefined();
  });

  it("rejects empty canonical IDs", () => {
    const result = modelWriteSchema.safeParse({
      canonicalId: "",
      name: "X",
      developerId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(false);
  });

  it("keeps nullable numeric fields as null instead of coercing to 0", () => {
    const parsed = modelWriteSchema.parse({
      canonicalId: "deepseek:v4-pro",
      name: "DeepSeek V4 Pro",
      developerId: "22222222-2222-2222-2222-222222222222",
      contextTokens: null,
      maxOutputTokens: null,
    });
    expect(parsed.contextTokens).toBeNull();
    expect(parsed.maxOutputTokens).toBeNull();
  });

  it("normalizes empty strings to null for optional text fields", () => {
    const parsed = modelWriteSchema.parse({
      canonicalId: "x:y",
      name: "Y",
      developerId: "22222222-2222-2222-2222-222222222222",
      family: "",
      bestUse: "",
    });
    expect(parsed.family).toBeNull();
    expect(parsed.bestUse).toBeNull();
  });

  it("accepts tri-state capabilities without coercing unknown", () => {
    const parsed = modelWriteSchema.parse({
      canonicalId: "x:y",
      name: "Y",
      developerId: "22222222-2222-2222-2222-222222222222",
      capabilities: { vision: null, reasoning: true, toolUse: false },
    });
    expect(parsed.capabilities?.vision).toBeNull();
    expect(parsed.capabilities?.reasoning).toBe(true);
    expect(parsed.capabilities?.toolUse).toBe(false);
  });
});

describe("modelListQuerySchema", () => {
  it("parses filters and boolean query flags", () => {
    const parsed = modelListQuerySchema.parse({
      search: "deepseek",
      developer: "deepseek",
      accessible: "true",
      archived: "false",
      limit: "25",
      page: "2",
    });
    expect(parsed.search).toBe("deepseek");
    expect(parsed.accessible).toBe(true);
    expect(parsed.archived).toBe(false);
    expect(parsed.limit).toBe(25);
    expect(parsed.page).toBe(2);
  });
});

describe("score and capability display invariants", () => {
  it("never renders blank scores as zero", () => {
    expect(formatScoreDisplay(null)).toBe("—");
    expect(formatScoreDisplay(undefined)).toBe("—");
    expect(formatScoreDisplay("")).toBe("—");
    expect(formatScoreDisplay(0)).toBe("0");
    expect(formatScoreDisplay("0")).toBe("0");
    expect(formatScoreDisplay(12.5)).toBe("12.5");
  });

  it("never coerces unknown capabilities to false", () => {
    expect(formatCapabilityDisplay(null)).toBe("unknown");
    expect(formatCapabilityDisplay(undefined)).toBe("unknown");
    expect(formatCapabilityDisplay(false)).toBe("no");
    expect(formatCapabilityDisplay(true)).toBe("yes");
  });

  it("parses tri-state import labels", () => {
    expect(parseTriState("unknown")).toBeNull();
    expect(parseTriState("")).toBeNull();
    expect(parseTriState("yes")).toBe(true);
    expect(parseTriState("no")).toBe(false);
    expect(parseTriState(1)).toBe(true);
    expect(parseTriState(0)).toBe(false);
  });

  it("requires override reason for manual scores", () => {
    const bad = modelScoreWriteSchema.safeParse({
      methodologyId: "33333333-3333-3333-3333-333333333333",
      scoreType: "capability",
      scoreValue: 10,
      isManualOverride: true,
    });
    expect(bad.success).toBe(false);

    const good = modelScoreWriteSchema.parse({
      methodologyId: "33333333-3333-3333-3333-333333333333",
      scoreType: "capability",
      scoreValue: null,
      isManualOverride: true,
      overrideReason: "Pending evidence",
    });
    expect(good.scoreValue).toBeNull();
  });
});

describe("merge helpers", () => {
  it("normalizes aliases", () => {
    expect(normalizeAlias("  DeepSeek   V4 ")).toBe("deepseek v4");
  });

  it("deduplicates aliases during merge planning", () => {
    const plan = planAliasMerge(
      ["deepseek v4"],
      [
        { alias: "DeepSeek V4", normalizedAlias: "deepseek v4" },
        { alias: "DS-V4", normalizedAlias: "ds-v4" },
      ],
    );
    expect(plan.transfer).toEqual([{ alias: "DS-V4", normalizedAlias: "ds-v4" }]);
    expect(plan.skippedDuplicates).toEqual(["DeepSeek V4"]);
  });

  it("deduplicates access paths by plan+provider model id", () => {
    const plan = planAccessMerge(
      [accessMergeKey({ planId: "p1", providerModelId: null })],
      [
        { id: "a1", planId: "p1", providerModelId: null },
        { id: "a2", planId: "p2", providerModelId: "x" },
      ],
    );
    expect(plan.transferIds).toEqual(["a2"]);
    expect(plan.skippedDuplicateIds).toEqual(["a1"]);
  });

  it("parses sort params", () => {
    expect(parseSortParam("-name")).toEqual({ field: "name", direction: "desc" });
    expect(parseSortParam("scores.capability")).toEqual({
      field: "capability",
      direction: "asc",
    });
  });
});

describe("subscriptionWriteSchema", () => {
  it("defaults usage tracking to manual", () => {
    const parsed = subscriptionWriteSchema.parse({
      planId: "33333333-3333-3333-3333-333333333333",
      accountLabel: "personal",
    });
    expect(parsed.usageTrackingMode).toBe("manual");
    expect(parsed.status).toBe("active");
  });
});

describe("shared enums and errors", () => {
  it("accepts active/archived record status only", () => {
    expect(recordStatusSchema.parse("active")).toBe("active");
    expect(recordStatusSchema.safeParse("deleted").success).toBe(false);
  });

  it("requires requestId on API errors", () => {
    const result = errorSchema.safeParse({
      error: { code: "BAD_REQUEST", message: "nope" },
    });
    expect(result.success).toBe(false);
  });
});
