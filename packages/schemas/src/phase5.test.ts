import { describe, expect, it } from "vitest";
import { auditQuerySchema, createApiTokenSchema, savedViewSchema, verificationSettingsSchema } from "./phase5";

describe("phase 5 schemas", () => {
  it("bounds token expiry/name and verification settings", () => {
    expect(createApiTokenSchema.safeParse({ name: "x", expiresAt: "bad" }).success).toBe(false);
    expect(verificationSettingsSchema.safeParse({ intervalDays: 0, thresholdDays: 1 }).success).toBe(false);
    expect(verificationSettingsSchema.safeParse({ intervalDays: 10, thresholdDays: 11 }).success).toBe(false);
  });
  it("validates view density and audit pagination", () => {
    expect(savedViewSchema.safeParse({ name: "v", columns: ["name"], filters: {}, density: "compact" }).success).toBe(true);
    expect(savedViewSchema.safeParse({ name: "v", columns: [], filters: {}, density: "dense" }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ cursor: "ignored" }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ from: "2025-01-02T00:00:00.000Z", to: "2025-01-01T00:00:00.000Z" }).success).toBe(false);
  });
  it("accepts valid token, settings, view, and audit inputs", () => {
    expect(createApiTokenSchema.safeParse({ name: " production ", expiresAt: null }).success).toBe(true);
    expect(verificationSettingsSchema.safeParse({ intervalDays: 3650, thresholdDays: 1 }).success).toBe(true);
    expect(savedViewSchema.safeParse({ name: "v", columns: ["name"], filters: {}, density: "comfortable", sort: null }).success).toBe(true);
    expect(auditQuerySchema.parse({}).limit).toBe(50);
  });
  it("rejects malformed and out-of-range phase 5 inputs", () => {
    expect(createApiTokenSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createApiTokenSchema.safeParse({ name: "x", expiresAt: "2025-01-01" }).success).toBe(false);
    expect(verificationSettingsSchema.safeParse({ intervalDays: 3651, thresholdDays: 1 }).success).toBe(false);
    expect(savedViewSchema.safeParse({ name: "v", columns: [""], filters: {}, density: "compact" }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});
