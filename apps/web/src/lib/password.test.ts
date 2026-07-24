import { describe, expect, it } from "vitest";
import { createPasswordHash, verifyPassword } from "./password";

describe("password hashing", () => {
  it("creates a verifiable salted hash", () => {
    const first = createPasswordHash("correct horse battery staple");
    const second = createPasswordHash("correct horse battery staple");

    expect(first).not.toBe(second);
    expect(verifyPassword("correct horse battery staple", first)).toBe(true);
    expect(verifyPassword("wrong password", first)).toBe(false);
  });

  it("rejects malformed hashes", () => {
    expect(verifyPassword("anything", "not-a-scrypt-hash")).toBe(false);
    expect(verifyPassword("anything", "scrypt:bad:hash")).toBe(false);
  });
});