import { describe, expect, it } from "vitest";
import {
  subscriptionWriteSchema,
  modelAccessWriteSchema,
  subscriptionListQuerySchema,
  modelAccessListQuerySchema,
} from "@model-monitor/schemas";

describe("subscriptionWriteSchema", () => {
  it("rejects empty accountLabel", () => {
    const result = subscriptionWriteSchema.safeParse({
      planId: "00000000-0000-4000-8000-000000000001",
      accountLabel: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only accountLabel", () => {
    const result = subscriptionWriteSchema.safeParse({
      planId: "00000000-0000-4000-8000-000000000001",
      accountLabel: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid minimal payload", () => {
    const result = subscriptionWriteSchema.safeParse({
      planId: "00000000-0000-4000-8000-000000000001",
      accountLabel: "mmtest:unit-valid",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planId).toBe("00000000-0000-4000-8000-000000000001");
      expect(result.data.accountLabel).toBe("mmtest:unit-valid");
      expect(result.data.status).toBe("active");
      expect(result.data.usageTrackingMode).toBe("manual");
    }
  });

  it("normalizes empty strings to null for nullable fields", () => {
    const result = subscriptionWriteSchema.safeParse({
      planId: "00000000-0000-4000-8000-000000000001",
      accountLabel: "mmtest:unit-nullify",
      usageCheckUrl: "",
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usageCheckUrl).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });

  it("returns field errors on nested invalid types", () => {
    const result = subscriptionWriteSchema.safeParse({
      planId: "not-a-uuid",
      accountLabel: "mmtest:unit-invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("modelAccessWriteSchema", () => {
  it("requires accessMethod", () => {
    const result = modelAccessWriteSchema.safeParse({
      modelId: "00000000-0000-4000-8000-000000000001",
      planId: "00000000-0000-4000-8000-000000000002",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid payload with accessMethod", () => {
    const result = modelAccessWriteSchema.safeParse({
      modelId: "00000000-0000-4000-8000-000000000001",
      planId: "00000000-0000-4000-8000-000000000002",
      accessMethod: "cli",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessMethod).toBe("cli");
      expect(result.data.cliOnly).toBe(false);
      expect(result.data.webOnly).toBe(false);
      expect(result.data.availability).toBe("unconfirmed");
    }
  });

  it("rejects invalid accessMethod value", () => {
    const result = modelAccessWriteSchema.safeParse({
      modelId: "00000000-0000-4000-8000-000000000001",
      planId: "00000000-0000-4000-8000-000000000002",
      accessMethod: "invalid_method",
    });
    expect(result.success).toBe(false);
  });
});

describe("subscriptionListQuerySchema", () => {
  it('parses archived="true" as true', () => {
    const result = subscriptionListQuerySchema.parse({ archived: "true" });
    expect(result.archived).toBe(true);
  });

  it('parses archived="false" as false', () => {
    const result = subscriptionListQuerySchema.parse({ archived: "false" });
    expect(result.archived).toBe(false);
  });

  it("parses missing archived as undefined", () => {
    const result = subscriptionListQuerySchema.parse({});
    expect(result.archived).toBeUndefined();
  });

  it("applies default sort and limit", () => {
    const result = subscriptionListQuerySchema.parse({});
    expect(result.sort).toBe("accountLabel");
    expect(result.limit).toBe(50);
  });

  it("parses boolean archived directly", () => {
    const result = subscriptionListQuerySchema.parse({ archived: true });
    expect(result.archived).toBe(true);
  });
});

describe("modelAccessListQuerySchema", () => {
  it("parses boolean flags from strings", () => {
    const result = modelAccessListQuerySchema.parse({
      cliOnly: "true",
      webOnly: "false",
      apiCompatible: "true",
    });
    expect(result.cliOnly).toBe(true);
    expect(result.webOnly).toBe(false);
    expect(result.apiCompatible).toBe(true);
  });

  it("parses boolean flags as booleans", () => {
    const result = modelAccessListQuerySchema.parse({
      cliOnly: true,
      webOnly: false,
    });
    expect(result.cliOnly).toBe(true);
    expect(result.webOnly).toBe(false);
  });

  it("applies defaults", () => {
    const result = modelAccessListQuerySchema.parse({});
    expect(result.cliOnly).toBeUndefined();
    expect(result.webOnly).toBeUndefined();
    expect(result.apiCompatible).toBeUndefined();
    expect(result.sort).toBe("modelName");
    expect(result.limit).toBe(100);
  });
});
