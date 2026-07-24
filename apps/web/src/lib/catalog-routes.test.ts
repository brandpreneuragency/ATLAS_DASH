import { beforeEach, describe, expect, it, vi } from "vitest";
import { hermesCatalogSchema, serializeHermesCatalog } from "@model-monitor/hermes-contract";

type Query = {
  from: () => Query;
  innerJoin: () => Query;
  leftJoin: () => Query;
  orderBy: () => Query;
  where: () => Query;
  then: (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mocks = vi.hoisted(() => {
  const db = { select: vi.fn(), update: vi.fn() };
  const column = new Proxy(
    {},
    { get: (_target, property) => (property === "then" ? undefined : column) },
  );
  const schema = new Proxy({}, { get: () => column });
  class MockModelServiceError extends Error {
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
    db,
    schema,
    MockModelServiceError,
    hashApiToken: vi.fn((token: string) => `hash:${token}`),
    isApiTokenUsable: vi.fn(() => true),
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@model-monitor/database", () => ({
  db: mocks.db,
  schema: mocks.schema,
  ModelServiceError: mocks.MockModelServiceError,
  hashApiToken: mocks.hashApiToken,
  isApiTokenUsable: mocks.isApiTokenUsable,
}));
vi.mock("@/lib/api", () => ({
  getRequestId: (request: Request) => request.headers.get("x-request-id") ?? "generated-request-id",
  jsonOk: (data: unknown, init?: { requestId?: string; status?: number }) => {
    const response = new Response(JSON.stringify(data), { status: init?.status ?? 200 });
    if (init?.requestId) response.headers.set("x-request-id", init.requestId);
    return response;
  },
  jsonError: (error: unknown, requestId: string) => {
    const typed = error as { code?: string; message?: string; status?: number; fieldErrors?: unknown };
    return new Response(
      JSON.stringify({
        error: {
          code: typed.code ?? "INTERNAL_ERROR",
          message: typed.message ?? "Unexpected error",
          requestId,
          ...(typed.fieldErrors ? { fieldErrors: typed.fieldErrors } : {}),
        },
      }),
      { status: typed.status ?? 500, headers: { "x-request-id": requestId } },
    );
  },
}));

import { GET } from "@/app/api/v1/hermes/catalog/route";

function query(result: unknown): Query {
  const pending = {} as Query;
  pending.from = () => pending;
  pending.innerJoin = () => pending;
  pending.leftJoin = () => pending;
  pending.orderBy = () => pending;
  pending.where = () => pending;
  pending.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return pending;
}

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/hermes/catalog", { headers });
}

const tokenRow = {
  id: "token-1",
  tokenHash: "hash:secret",
  revokedAt: null,
  expiresAt: null,
  scopes: ["catalog:read"],
};

const activeModel = {
  id: "model-1",
  canonicalId: "z/model",
  name: "Z Model",
  developerId: "developer-1",
  family: null,
  lifecycle: "current",
  status: "active",
  contextTokens: null,
  maxOutputTokens: null,
  speedRating: null,
  verifiedTps: null,
  verifiedAt: null,
  needsRecheck: true,
};

describe("Hermes catalog contract", () => {
  beforeEach(() => {
    mocks.db.select.mockReset();
    mocks.db.update.mockReset();
    mocks.hashApiToken.mockClear();
    mocks.isApiTokenUsable.mockReset().mockReturnValue(true);
  });

  it("validates, preserves nulls, and deterministically orders models", () => {
    const model = (canonicalId: string) => ({
      model: {
        canonicalId,
        name: canonicalId,
        developer: "Developer",
        family: null,
        lifecycle: "current",
        contextTokens: null,
        maxOutputTokens: null,
        speedRating: null,
        verifiedTps: null,
        verifiedAt: null,
        needsRecheck: true,
        vision: null,
        reasoning: null,
        toolUse: null,
        parallelAgents: null,
        computerUse: null,
      },
      scores: {},
      access: [],
    });
    const catalog = serializeHermesCatalog({
      generatedAt: "2026-07-23T00:00:00.000Z",
      catalogRevision: 1,
      models: [model("z/model"), model("a/model")],
    });
    expect(catalog.models.map((model) => model.canonicalId)).toEqual(["a/model", "z/model"]);
    expect(catalog.models[0]?.capabilities.vision).toBeNull();
    expect(() => hermesCatalogSchema.parse({ ...catalog, catalogRevision: 0 })).toThrow();
  });

  it("rejects fabricated capability and invalid access values", () => {
    const catalog = serializeHermesCatalog({
      generatedAt: "2026-07-23T00:00:00.000Z",
      catalogRevision: 1,
      models: [{
        model: {
          canonicalId: "a/model",
          name: "A Model",
          developer: "Developer",
          family: null,
          lifecycle: "current",
          contextTokens: null,
          maxOutputTokens: null,
          speedRating: null,
          verifiedTps: null,
          verifiedAt: null,
          needsRecheck: true,
          vision: null,
          reasoning: null,
          toolUse: null,
          parallelAgents: null,
          computerUse: null,
        },
        scores: {},
        access: [],
      }],
    });
    expect(() => hermesCatalogSchema.parse({
      ...catalog,
      models: [{
        ...catalog.models[0],
        capabilities: { ...catalog.models[0].capabilities, vision: "unknown" },
      }],
    })).toThrow();
  });

  it("does not mutate input ordering", () => {
    const input = ["z/model", "a/model"].map((canonicalId) => ({
      model: {
        canonicalId,
        name: canonicalId,
        developer: "Developer",
        family: null,
        lifecycle: "current",
        contextTokens: null,
        maxOutputTokens: null,
        speedRating: null,
        verifiedTps: null,
        verifiedAt: null,
        needsRecheck: true,
        vision: null,
        reasoning: null,
        toolUse: null,
        parallelAgents: null,
        computerUse: null,
      },
      scores: {},
      access: [],
    }));
    serializeHermesCatalog({ generatedAt: "2026-07-23T00:00:00.000Z", catalogRevision: 1, models: input });
    expect(input.map((item) => item.model.canonicalId)).toEqual(["z/model", "a/model"]);
  });

  it.each(["missing", "invalid", "expired", "revoked", "wrong-scope"])(
    "rejects %s bearer tokens with request ID",
    async (kind) => {
      if (kind !== "missing") {
        mocks.db.select.mockReturnValue(query([tokenRow]));
        mocks.isApiTokenUsable.mockReturnValue(false);
      }
      const response = await GET(request(kind === "missing" ? { "x-request-id": "req-auth" } : {
        authorization: "Bearer secret",
        "x-request-id": "req-auth",
      }));
      expect(response.status).toBe(401);
      expect(response.headers.get("x-request-id")).toBe("req-auth");
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
    },
  );

  it("returns a direct schema-valid catalog, labels mock usage, and does not write", async () => {
    mocks.db.select
      .mockReturnValueOnce(query([tokenRow]))
      .mockReturnValueOnce(query([{ model: activeModel, developer: "Developer" }]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([{
        access: {
          modelId: "model-1",
          providerModelId: null,
          availability: "confirmed",
          accessMethod: "cli",
          apiCompatible: null,
          cliOnly: true,
          webOnly: false,
          limitations: null,
        },
        provider: "Provider",
        plan: "Plan",
        subscriptionId: "subscription-1",
      }]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([{
        modelId: "model-1",
        subscriptionId: "subscription-1",
        source: "mock",
        isMock: true,
        usedPercent: "25",
        capturedAt: new Date("2026-07-23T00:00:00.000Z"),
      }]));

    const response = await GET(request({ authorization: "Bearer secret", "x-request-id": "req-catalog" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("req-catalog");
    const body = hermesCatalogSchema.parse(await response.json());
    expect(body.models).toHaveLength(1);
    expect(body.models[0]?.access[0]?.available).toBe(true);
    expect(body.models[0]?.access[0]?.usage).toMatchObject({ source: "mock", isMock: true, usedPercent: 25 });
    expect(response.headers.get("etag")).toBeTruthy();
    expect(mocks.db.update).not.toHaveBeenCalled();

    mocks.db.select.mockReturnValueOnce(query([tokenRow]));
    const cachedResponse = await GET(request({
      authorization: "Bearer secret",
      "if-none-match": response.headers.get("etag") ?? "",
      "x-request-id": "req-not-modified",
    }));
    expect(cachedResponse.status).toBe(304);
    expect(cachedResponse.headers.get("x-request-id")).toBe("req-not-modified");
  });
});