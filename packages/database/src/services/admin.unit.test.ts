import { describe, expect, it } from "vitest";
import { hashApiToken, isApiTokenUsable, safeApiTokenResponse } from "./admin";
import { jsonSafe } from "./audit";

describe("phase 5 admin token helpers", () => {
  it("hashes deterministically and never returns tokenHash", () => {
    expect(hashApiToken("mm_secret")).toHaveLength(64);
    expect(safeApiTokenResponse({ id: "1", tokenHash: "hash", name: "n" })).toEqual({ id: "1", name: "n" });
    expect(safeApiTokenResponse({ id: "1", tokenHash: "hash", name: "n" }, "mm_secret")).toMatchObject({ token: "mm_secret" });
  });
  it("requires scope and rejects expired or revoked tokens", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const base = { revokedAt: null, expiresAt: new Date("2025-01-02T00:00:00Z"), scopes: ["catalog:read"] };
    expect(isApiTokenUsable(base, "catalog:read", now)).toBe(true);
    expect(isApiTokenUsable(base, "admin", now)).toBe(false);
    expect(isApiTokenUsable({ ...base, expiresAt: new Date("2024-01-01T00:00:00Z") }, "catalog:read", now)).toBe(false);
    expect(isApiTokenUsable({ ...base, revokedAt: now }, "catalog:read", now)).toBe(false);
  });
  it("redacts credential fields but preserves domain token counts", () => {
    expect(jsonSafe({ token: "secret", tokenHash: "hash", contextTokens: 100 })).toEqual({ token: "[REDACTED]", tokenHash: "[REDACTED]", contextTokens: 100 });
  });
  it("omits hashes from rows with unrelated optional fields", () => {
    expect(safeApiTokenResponse({ id: "1", tokenHash: "hash", scopes: ["catalog:read"], expiresAt: null, revokedAt: null })).not.toHaveProperty("tokenHash");
  });
  it("reveals plaintext only when explicitly supplied", () => {
    expect(safeApiTokenResponse({ id: "1", tokenHash: "hash" })).not.toHaveProperty("token");
    expect(safeApiTokenResponse({ id: "1", tokenHash: "hash" }, "mm_once")).toMatchObject({ token: "mm_once" });
  });
  it("rejects missing required scope", () => {
    expect(isApiTokenUsable({ revokedAt: null, expiresAt: null, scopes: [] })).toBe(false);
  });
  it("handles non-expiring tokens", () => {
    expect(isApiTokenUsable({ revokedAt: null, expiresAt: null, scopes: ["catalog:read"] })).toBe(true);
  });
  it("requires exact scope membership", () => {
    expect(isApiTokenUsable({ revokedAt: null, expiresAt: null, scopes: ["catalog:read-extra"] })).toBe(false);
  });
});
