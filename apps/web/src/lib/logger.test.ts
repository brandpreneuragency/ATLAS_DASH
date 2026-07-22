import { describe, expect, it, vi, afterEach } from "vitest";
import { logger } from "./logger";

interface LogPayload {
  level: string;
  message: string;
  requestId?: string;
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
});
