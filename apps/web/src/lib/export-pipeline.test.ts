import { describe, expect, it } from "vitest";
import { buildExportPayload, preparePayload, serializeCsv, serializeXlsx } from "./export-pipeline";

describe("export pipeline", () => {
  const payload = buildExportPayload({ format: "json", scope: "models", formulasNeutralized: false, models: [{ canonicalId: "m", name: "=SUM(1,2)", slug: "m", lifecycle: "current", contextTokens: null }] });
  it("validates typed payloads and preserves nulls", () => expect(payload.models?.[0]?.contextTokens).toBeNull());
  it("emits section headers as separate CSV cells", () => expect(serializeCsv(payload).split("\r\n")[0]).toBe("models,canonicalId,name,slug,lifecycle,contextTokens"));
  it("escapes CSV fields and neutralizes formula text", () => {
    const csv = serializeCsv(preparePayload(payload));
    expect(csv).toContain("'=SUM(1,2)");
    expect(csv).toContain('"\'=SUM(1,2)"');
  });
  it("serializes provenance in JSON and CSV exports", () => {
    const provenance = {
      id: "11111111-1111-4111-8111-111111111111",
      importJobId: "22222222-2222-4222-8222-222222222222",
      entityType: "model",
      entityId: "33333333-3333-4333-8333-333333333333",
      sourceSheet: "Models",
      sourceRow: 7,
      sourceColumn: "B",
      rawValue: "raw model value",
      createdAt: "2026-07-23T00:00:00.000Z",
    };
    const withProvenance = buildExportPayload({ ...payload, provenance: [provenance] });
    expect(JSON.stringify(withProvenance)).toContain('"provenance"');
    expect(serializeCsv(withProvenance)).toContain("provenance,id,importJobId,entityType,entityId,sourceSheet,sourceRow,sourceColumn,rawValue,createdAt");
    expect(serializeCsv(withProvenance)).toContain("raw model value");
  });
  it("emits XLSX zip bytes", async () => expect(Array.from((await serializeXlsx(payload)).slice(0, 2))).toEqual([80, 75]));
});
