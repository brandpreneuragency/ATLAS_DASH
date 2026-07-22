import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelServiceError } from "@model-monitor/database";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import {
  jsonError,
  parseIdempotencyKey,
  parseJsonBody,
  parsePathUuid,
  unauthorizedJson,
} from "./api";

describe("parsePathUuid", () => {
  it("accepts valid UUIDs", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    expect(parsePathUuid(id, "modelId")).toBe(id);
  });

  it("rejects invalid UUIDs with validation error", () => {
    try {
      parsePathUuid("not-a-uuid", "modelId");
      expect.unreachable("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ModelServiceError);
      const err = error as ModelServiceError;
      expect(err.status).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      headers: { "content-type": "application/json" },
    });
    await expect(parseJsonBody(request)).resolves.toEqual({ a: 1 });
  });

  it("maps malformed JSON to 400 validation error", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "{bad",
      headers: { "content-type": "application/json" },
    });
    await expect(parseJsonBody(request)).rejects.toMatchObject({
      name: "ModelServiceError",
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });
});

describe("parseIdempotencyKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires non-blank bounded key", () => {
    const good = new Request("http://localhost/api", {
      headers: { "Idempotency-Key": "abc-123" },
    });
    expect(parseIdempotencyKey(good)).toBe("abc-123");

    const blank = new Request("http://localhost/api", {
      headers: { "Idempotency-Key": "   " },
    });
    expect(() => parseIdempotencyKey(blank)).toThrow(ModelServiceError);

    const missing = new Request("http://localhost/api");
    expect(() => parseIdempotencyKey(missing)).toThrow(ModelServiceError);

    const tooLong = new Request("http://localhost/api", {
      headers: { "Idempotency-Key": "x".repeat(129) },
    });
    expect(() => parseIdempotencyKey(tooLong)).toThrow(ModelServiceError);
  });
});

describe("unauthorizedJson", () => {
  it("returns structured 401 JSON", async () => {
    const response = unauthorizedJson("req_test");
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("req_test");
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Authentication required");
    expect(body.error.requestId).toBe("req_test");
  });
});

describe("jsonError secret-safe logging", () => {
  it("never logs raw Error.message that may contain secrets", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secretMessage =
      "password=hunter2 token=abc DATABASE_URL=postgresql://u:SECRET_PASS@host/db";
    const response = jsonError(new Error(secretMessage), "req_safe");
    expect(response.status).toBe(500);
    const line = String(spy.mock.calls[0]?.[0] ?? "");
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("SECRET_PASS");
    expect(line).not.toContain("password=hunter2");
    expect(line).toContain("req_safe");
    expect(line).toContain("Error");
    spy.mockRestore();
  });
});