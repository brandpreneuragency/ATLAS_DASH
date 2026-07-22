import { describe, expect, it } from "vitest";
import {
  modelWriteSchema,
  subscriptionWriteSchema,
  errorSchema,
  recordStatusSchema,
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
