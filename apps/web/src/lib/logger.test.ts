import { describe, expect, it, vi, afterEach } from "vitest";
import { logger } from "./logger";

interface LogPayload {
  level: string;
  message: string;
  requestId?: string;
  nested?: {
    apiKey?: string;
    ok?: boolean;
    authorization?: string;
  };
  password?: string;
  token?: string;
  cookie?: string;
  clientSecret?: string;
  privateKey?: string;
  secret?: string;
  err?: { name?: string; message?: string; code?: string };
}

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits JSON info lines without secrets fields by default", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logger.info("request completed", { requestId: "req_1", durationMs: 12 });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as LogPayload;
    expect(payload.level).toBe("info");
    expect(payload.message).toBe("request completed");
    expect(payload.requestId).toBe("req_1");
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("token");
  });

  it("writes errors to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logger.error("boom", { requestId: "req_2" });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0])) as LogPayload;
    expect(payload.level).toBe("error");
  });

  it("recursively redacts nested sensitive keys and never prints fake secrets", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secrets = {
      password: "p@ssw0rd-should-not-appear",
      TOKEN: "top-level-token-value",
      cookie: "session=abc",
      clientSecret: "oauth-client-secret",
      private_key: "PEM-PRIVATE",
      authorization: "Bearer super-secret",
      nested: {
        apiKey: "nested-api-key-value",
        ok: true,
        Authorization: "Bearer nested",
      },
      list: [{ secret: "inside-array" }, { safe: "visible" }],
    };

    logger.error("api_error", secrets);
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain("p@ssw0rd-should-not-appear");
    expect(line).not.toContain("top-level-token-value");
    expect(line).not.toContain("session=abc");
    expect(line).not.toContain("oauth-client-secret");
    expect(line).not.toContain("PEM-PRIVATE");
    expect(line).not.toContain("Bearer super-secret");
    expect(line).not.toContain("nested-api-key-value");
    expect(line).not.toContain("Bearer nested");
    expect(line).not.toContain("inside-array");
    expect(line).toContain("[REDACTED]");
    expect(line).toContain('"ok":true');
    expect(line).toContain('"safe":"visible"');
  });

  it("redacts secrets embedded in Error objects and handles circular metadata", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {
      requestId: "req_circ",
      note: "safe",
    };
    circular.self = circular;
    const err = new Error(
      "connect failed postgresql://modelmonitor:SuperSecretDSN@127.0.0.1:5433/modelmonitor",
    );
    circular.err = err;

    logger.error("api_error", circular);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain("SuperSecretDSN");
    expect(line).not.toContain("postgresql://");
    expect(line).toContain("req_circ");
    expect(line).toContain("safe");
    expect(line).toContain("[Circular]");
  });
});
