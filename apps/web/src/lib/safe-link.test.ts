import { describe, expect, it } from "vitest";
import { displayUrlText, isSafeHttpUrl, safeHref } from "./safe-link";

describe("safe link helpers", () => {
  it("accepts http and https", () => {
    expect(isSafeHttpUrl("https://example.com/a")).toBe(true);
    expect(isSafeHttpUrl("http://example.com")).toBe(true);
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
  });

  it("rejects javascript, data, malformed", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,hi")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref(null)).toBeNull();
    expect(displayUrlText("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});
