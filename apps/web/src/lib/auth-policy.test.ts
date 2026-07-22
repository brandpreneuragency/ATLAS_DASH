import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowedEmails } from "./auth-policy";

describe("parseAllowedEmails", () => {
  it("splits, trims, and lowercases", () => {
    expect(parseAllowedEmails(" Alice@Example.com, bob@test.com ")).toEqual([
      "alice@example.com",
      "bob@test.com",
    ]);
  });

  it("returns empty list for missing input", () => {
    expect(parseAllowedEmails(undefined)).toEqual([]);
    expect(parseAllowedEmails("")).toEqual([]);
  });
});

describe("isEmailAllowed", () => {
  it("denies missing email", () => {
    expect(
      isEmailAllowed(null, { allowedEmails: ["a@b.com"], devBypass: false }),
    ).toBe(false);
  });

  it("denies when allow-list is empty and bypass is off", () => {
    expect(
      isEmailAllowed("a@b.com", { allowedEmails: [], devBypass: false }),
    ).toBe(false);
  });

  it("allows only listed emails", () => {
    expect(
      isEmailAllowed("a@b.com", {
        allowedEmails: ["a@b.com"],
        devBypass: false,
      }),
    ).toBe(true);
    expect(
      isEmailAllowed("other@b.com", {
        allowedEmails: ["a@b.com"],
        devBypass: false,
      }),
    ).toBe(false);
  });

  it("allows any email when dev bypass is enabled", () => {
    expect(
      isEmailAllowed("anyone@example.com", {
        allowedEmails: [],
        devBypass: true,
      }),
    ).toBe(true);
  });
});
