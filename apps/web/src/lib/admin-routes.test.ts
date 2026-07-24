import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestModelServiceError extends Error {
    readonly code: string;
    readonly status: number;
    readonly fieldErrors?: Record<string, string[]>;

    constructor(code: string, message: string, status: number, fieldErrors?: Record<string, string[]>) {
      super(message);
      this.name = "ModelServiceError";
      this.code = code;
      this.status = status;
      this.fieldErrors = fieldErrors;
    }
  }

  return {
    db: { mocked: true },
    session: { userId: null as string | null, email: null as string | null },
    createApiToken: vi.fn(),
    listApiTokens: vi.fn(),
    revokeApiToken: vi.fn(),
    getVerificationSettings: vi.fn(),
    setVerificationSettings: vi.fn(),
    createSavedView: vi.fn(),
    listSavedViews: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
    listAuditEvents: vi.fn(),
    TestModelServiceError,
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@model-monitor/database", () => ({
  ModelServiceError: mocks.TestModelServiceError,
  safeApiTokenResponse: (value: Record<string, unknown>, token?: string) => {
  const { tokenHash: _tokenHash, ...safe } = value;
  return token ? { ...safe, token } : safe;
  },
  createApiToken: mocks.createApiToken,
  listApiTokens: mocks.listApiTokens,
  revokeApiToken: mocks.revokeApiToken,
  getVerificationSettings: mocks.getVerificationSettings,
  setVerificationSettings: mocks.setVerificationSettings,
  createSavedView: mocks.createSavedView,
  listSavedViews: mocks.listSavedViews,
  updateSavedView: mocks.updateSavedView,
  deleteSavedView: mocks.deleteSavedView,
  listAuditEvents: mocks.listAuditEvents,
}));
vi.mock("@/lib/api", () => ({
  auditContext: (request: Request, actorUserId?: string | null) => ({
    requestId: request.headers.get("x-request-id") ?? "generated",
    actorUserId: actorUserId ?? null,
  }),
  getRequestId: (request: Request) => request.headers.get("x-request-id") ?? "generated",
  jsonOk: <T>(data: T, init?: { status?: number; requestId?: string }) =>
    Response.json(data, { status: init?.status ?? 200, headers: { "x-request-id": init?.requestId ?? "generated" } }),
  jsonError: (error: unknown, requestId: string) => {
    const e = error as { code?: string; message?: string; status?: number; fieldErrors?: unknown };
    const isValidation = error instanceof Error && error.name === "ZodError";
    return Response.json(
      { error: { code: isValidation ? "VALIDATION_ERROR" : e.code ?? "INTERNAL_ERROR", message: e.message ?? "Unexpected error", requestId, fieldErrors: e.fieldErrors } },
      { status: isValidation ? 400 : e.status ?? 500, headers: { "x-request-id": requestId } },
    );
  },
  parseJsonBody: async (request: Request): Promise<unknown> => {
    try { return await request.json(); } catch { throw new mocks.TestModelServiceError("VALIDATION_ERROR", "Malformed JSON body", 400); }
  },
  parsePathUuid: (value: string, field = "id") => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new mocks.TestModelServiceError("VALIDATION_ERROR", `Invalid ${field}`, 400);
    }
    return value;
  },
  requireApiSession: async () => {
    if (!mocks.session.userId) throw new mocks.TestModelServiceError("UNAUTHORIZED", "Authentication required", 401);
    return mocks.session;
  },
}));

import { GET as getTokens, POST as postTokens } from "../app/api/v1/api-tokens/route";
import { DELETE as deleteToken } from "../app/api/v1/api-tokens/[tokenId]/route";
import { GET as getAudit } from "../app/api/v1/audit-events/route";
import { GET as getViews, POST as postViews } from "../app/api/v1/saved-views/route";
import { DELETE as deleteView, PATCH as patchView } from "../app/api/v1/saved-views/[viewId]/route";
import { GET as getVerification, PATCH as patchVerification } from "../app/api/v1/settings/verification/route";

type Json = Record<string, unknown>;
const id = "11111111-1111-4111-8111-111111111111";
const request = (method: string, path: string, body?: unknown) => new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json", "x-request-id": "req-admin" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const json = async (response: Response) => (await response.json()) as Json;
const params = (viewId: string) => ({ params: Promise.resolve({ viewId }) });

beforeEach(() => { vi.clearAllMocks(); mocks.session.userId = null; mocks.session.email = null; });

describe("Phase 5 administration routes", () => {
  it.each([
    ["token GET", () => getTokens(request("GET", "/api/v1/api-tokens"))],
    ["token POST", () => postTokens(request("POST", "/api/v1/api-tokens", {}))],
    ["token DELETE", () => deleteToken(request("DELETE", `/api/v1/api-tokens/${id}`), { params: Promise.resolve({ tokenId: id }) })],
    ["saved view PATCH", () => patchView(request("PATCH", `/api/v1/saved-views/${id}`, {}), params(id))],
    ["saved view DELETE", () => deleteView(request("DELETE", `/api/v1/saved-views/${id}`), params(id))],
  ])("%s rejects anonymous requests with 401", async (_, run) => expect((await run()).status).toBe(401));

  it("maps malformed token, settings, and saved-view bodies to 400", async () => {
    mocks.session.userId = "user-1";
    expect((await postTokens(request("POST", "/api/v1/api-tokens", { name: "" }))).status).toBe(400);
    expect((await patchVerification(request("PATCH", "/api/v1/settings/verification", { intervalDays: 0 })) ).status).toBe(400);
    expect((await postViews(request("POST", "/api/v1/saved-views", { name: "" }))).status).toBe(400);
  });

  it("creates a token with plaintext only in the 201 response and preserves request id", async () => {
    mocks.session.userId = "user-1";
    mocks.createApiToken.mockResolvedValue({ id, name: "CI", token: "plain-token" });
    const response = await postTokens(request("POST", "/api/v1/api-tokens", { name: "CI" }));
    const body = await json(response);
    expect(response.status).toBe(201);
    expect(response.headers.get("x-request-id")).toBe("req-admin");
    expect(body).toEqual({ id, name: "CI", token: "plain-token" });
    expect(JSON.stringify(body)).not.toContain("tokenHash");
  });

  it("uses the authenticated owner for saved-view PATCH/DELETE and maps missing ids to 404", async () => {
    mocks.session.userId = "owner-1";
    mocks.updateSavedView.mockRejectedValue(new mocks.TestModelServiceError("NOT_FOUND", "Saved view not found", 404));
    mocks.deleteSavedView.mockRejectedValue(new mocks.TestModelServiceError("NOT_FOUND", "Saved view not found", 404));
    expect((await patchView(request("PATCH", `/api/v1/saved-views/${id}`, { name: "x" }), params(id))).status).toBe(404);
    expect((await deleteView(request("DELETE", `/api/v1/saved-views/${id}`), params(id))).status).toBe(404);
    expect(mocks.updateSavedView).toHaveBeenCalledWith(mocks.db, "owner-1", id, { name: "x" }, "req-admin");
    expect(mocks.deleteSavedView).toHaveBeenCalledWith(mocks.db, "owner-1", id, "req-admin");
  });

  it("returns verification and audit response shapes", async () => {
    mocks.session.userId = "user-1";
    mocks.getVerificationSettings.mockResolvedValue({ intervalDays: 30, thresholdDays: 30 });
    mocks.setVerificationSettings.mockResolvedValue({ intervalDays: 14, thresholdDays: 7 });
    mocks.listAuditEvents.mockResolvedValue({ data: [{ id }], page: { limit: 50, offset: 0 }, meta: { total: 1 } });
    expect(await json(await getVerification(request("GET", "/api/v1/settings/verification")))).toMatchObject({ data: { intervalDays: 30, thresholdDays: 30 }, meta: { requestId: "req-admin" } });
    expect(await json(await patchVerification(request("PATCH", "/api/v1/settings/verification", { intervalDays: 14, thresholdDays: 7 })))).toMatchObject({ data: { intervalDays: 14 }, meta: { requestId: "req-admin" } });
    expect(await json(await getAudit(request("GET", "/api/v1/audit-events")))).toEqual({ data: [{ id }], page: { limit: 50, offset: 0 }, meta: { total: 1, requestId: "req-admin" } });
  });

  it("requires authentication for representative settings and audit GET routes", async () => {
    expect((await getVerification(request("GET", "/api/v1/settings/verification"))).status).toBe(401);
    expect((await getAudit(request("GET", "/api/v1/audit-events"))).status).toBe(401);
    expect((await getViews(request("GET", "/api/v1/saved-views"))).status).toBe(401);
  });
});
