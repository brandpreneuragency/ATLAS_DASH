import { describe, expect, it } from "vitest";
import { readApiData } from "./settings-panel";

describe("Settings API response parsing", () => {
  it("returns data from a successful envelope", async () => {
    const response = new Response(JSON.stringify({ data: [{ id: "token-1" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(readApiData<{ id: string }[]>(response)).resolves.toEqual([
      { id: "token-1" },
    ]);
  });

  it("rejects non-success and malformed responses instead of dereferencing missing data", async () => {
    const failed = new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
    const malformed = new Response(JSON.stringify({ meta: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    await expect(readApiData(failed)).rejects.toThrow("API request failed");
    await expect(readApiData(malformed)).rejects.toThrow("Invalid API response");
  });
});
