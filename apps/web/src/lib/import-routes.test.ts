import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireApiSession, getImportJob, withIdempotency, commitImport, resolveConflicts, intakeWorkbook, buildImportPlan } = vi.hoisted(() => ({
  requireApiSession: vi.fn(),
  getImportJob: vi.fn(),
  withIdempotency: vi.fn(),
  commitImport: vi.fn(),
  resolveConflicts: vi.fn(),
  intakeWorkbook: vi.fn(),
  buildImportPlan: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  getRequestId: () => "request-1",
  jsonOk: (data: unknown, init?: { status?: number }) => new Response(JSON.stringify(data), { status: init?.status ?? 200 }),
  jsonError: (error: unknown) => {
    const value = typeof error === "object" && error !== null && "code" in error ? String(error.code) : error instanceof Error ? error.message : "ERROR";
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : value === "UNAUTHORIZED" ? 401 : 400;
    return new Response(JSON.stringify({ error: { code: value, message: value, requestId: "request-1" } }), { status });
  },
  parsePathUuid: (value: string) => {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) throw new Error("VALIDATION_ERROR");
    return value;
  },
  parseIdempotencyKey: (request: Request) => request.headers.get("Idempotency-Key") ?? (() => { throw new Error("Idempotency-Key"); })(),
  parseJsonBody: (request: Request) => request.json().catch(() => { throw new Error("VALIDATION_ERROR"); }),
  auditContext: () => ({ requestId: "request-1", actorUserId: null }),
  requireApiSession,
}));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }));
vi.mock("@model-monitor/database", () => ({ ModelServiceError: class ModelServiceError extends Error { status: number; code: string; constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; } }, getImportJob, hashIdempotencyPayload: vi.fn(() => "hash"), withIdempotency, commitImport, resolveConflicts }));
vi.mock("@model-monitor/excel-import", () => ({ intakeWorkbook, storeFileUnder: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/import-pipeline", () => ({ buildImportPlan }));

import { POST as preview } from "@/app/api/v1/imports/preview/route";
import { POST as commit } from "@/app/api/v1/imports/[importId]/commit/route";
import { POST as conflicts } from "@/app/api/v1/imports/[importId]/conflicts/route";

const id = "00000000-0000-0000-0000-000000000001";
const params = { params: Promise.resolve({ importId: id }) };
async function body(response: Response) { return (await response.json()) as { error?: { code: string }; [key: string]: unknown }; }

beforeEach(() => {
  vi.clearAllMocks();
  requireApiSession.mockResolvedValue({ userId: id });
  getImportJob.mockResolvedValue({ id, storedPath: "/tmp/import.xlsx" });
  buildImportPlan.mockResolvedValue({ plan: {}, summary: {}, conflicts: [], errors: [], sheets: [] });
});

describe("import route boundaries", () => {
  it("requires authentication for preview", async () => {
    requireApiSession.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await preview(new Request("http://localhost"))).status).toBe(401);
  });
  it("rejects preview without a file", async () => {
    const response = await preview(new Request("http://localhost", { method: "POST", body: new FormData() }));
    expect(response.status).toBe(400); expect((await body(response)).error?.code).toBe("VALIDATION_ERROR");
  });
  it.each(["data.csv", "huge.xlsx"]) ("rejects unsupported/oversized intake (%s)", async (name) => {
    intakeWorkbook.mockRejectedValue(new Error("INTAKE_ERROR"));
    const form = new FormData(); form.append("file", new File(["x"], name));
    const response = await preview(new Request("http://localhost", { method: "POST", body: form }));
    expect(response.status).toBe(400); expect(intakeWorkbook).toHaveBeenCalled();
  });
  it("rejects invalid import UUID before database access", async () => {
    const response = await commit(new Request("http://localhost"), { params: Promise.resolve({ importId: "not-a-uuid" }) });
    expect(response.status).toBe(400); expect((await body(response)).error?.code).toBe("VALIDATION_ERROR"); expect(getImportJob).not.toHaveBeenCalled();
  });
  it("rejects commit without Idempotency-Key", async () => {
    const response = await commit(new Request("http://localhost"), params);
    expect(response.status).toBe(400); expect((await body(response)).error?.code).toBe("Idempotency-Key");
  });
  it("rejects malformed and semantically invalid conflict payloads", async () => {
    expect((await conflicts(new Request("http://localhost", { method: "POST", body: "not-json" }), params)).status).toBe(400);
    resolveConflicts.mockRejectedValueOnce(Object.assign(new Error("VALIDATION_ERROR"), { status: 400 }));
    const response = await conflicts(new Request("http://localhost", { method: "POST", body: JSON.stringify({ importJobId: id, resolutions: [{ conflictId: "bad", action: "nope" }] }) }), params);
    expect(response.status).toBe(400); expect(resolveConflicts).toHaveBeenCalled();
  });
  it("returns successful conflict resolution", async () => {
    resolveConflicts.mockResolvedValue([{ id: id, resolution: "keep_existing" }]);
    const response = await conflicts(new Request("http://localhost", { method: "POST", body: JSON.stringify({ importJobId: id, resolutions: [{ conflictId: id, action: "keep_existing" }] }) }), params);
    expect(response.status).toBe(200); expect((await body(response)).conflicts).toBeDefined();
  });
  it("returns commit response and marks idempotent replay", async () => {
    withIdempotency.mockResolvedValue({ status: 200, replay: true, body: { id, commitSummary: {} } });
    const response = await commit(new Request("http://localhost", { method: "POST", headers: { "Idempotency-Key": "key-1" } }), params);
    expect(response.status).toBe(200); expect(response.headers.get("Idempotency-Replayed")).toBe("true"); expect((await body(response)).id).toBe(id);
  });
});
