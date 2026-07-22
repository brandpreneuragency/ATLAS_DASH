import { describe, expect, it } from "vitest";
import { GET } from "../app/api/v1/health/route";

interface HealthResponse {
  status: string;
  database: string;
  time: string;
}

describe("GET /api/v1/health", () => {
  it("returns ok JSON payload", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as HealthResponse;
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(typeof body.time).toBe("string");
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
