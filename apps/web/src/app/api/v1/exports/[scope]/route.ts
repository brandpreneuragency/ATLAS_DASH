import {
  listExportAccess,
  listExportBenchmarks,
  listExportModels,
  listExportSubscriptions,
  listExportScores,
  listExportSources,
  listExportProvenance,
} from "@model-monitor/database";
import { exportRequestSchema } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { getRequestId, jsonError, requireApiSession } from "@/lib/api";
import { buildExportPayload, filename, mimeTypes, preparePayload, serializeExport } from "@/lib/export-pipeline";

function bool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Invalid boolean query parameter");
}

export async function GET(request: Request, context: { params: Promise<{ scope: string }> }) {
  const requestId = getRequestId(request);
  try {
    await requireApiSession(requestId);
    const { scope } = await context.params;
    const url = new URL(request.url);
    const raw = {
      scope,
      format: url.searchParams.get("format") ?? "json",
      includeArchived: bool(url.searchParams.get("includeArchived")),
      includeProvenance: bool(url.searchParams.get("includeProvenance")),
      neutralizeFormulas: bool(url.searchParams.get("neutralizeFormulas")),
    };
    const parsed = exportRequestSchema.safeParse(raw);
    if (!parsed.success) return new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Invalid export request", requestId } }), { status: 400, headers: { "content-type": "application/json", "x-request-id": requestId } });
    const input = parsed.data;

    const options = { includeArchived: input.includeArchived, neutralizeFormulas: input.neutralizeFormulas };
    const payload = preparePayload(buildExportPayload({
      format: input.format,
      scope: input.scope,
      formulasNeutralized: input.neutralizeFormulas,
      ...(input.scope === "models" || input.scope === "full" ? { models: await listExportModels(db, options) } : {}),
      ...(input.scope === "subscriptions" || input.scope === "full" ? { subscriptions: await listExportSubscriptions(db, options) } : {}),
      ...(input.scope === "access" || input.scope === "full" ? { access: await listExportAccess(db, options) } : {}),
      ...(input.scope === "benchmarks" || input.scope === "full" ? { benchmarks: await listExportBenchmarks(db, options) } : {}),
      ...(input.scope === "scores" || input.scope === "full" ? { scores: await listExportScores(db, options) } : {}),
      ...(input.scope === "sources" || input.scope === "full" ? { sources: await listExportSources(db, options) } : {}),
      ...(input.includeProvenance ? { provenance: await listExportProvenance(db) } : {}),
    }));
    const bytes = await serializeExport(payload, input.format);
    return new Response(new Uint8Array(bytes).buffer, { headers: { "content-type": mimeTypes[input.format], "content-disposition": `attachment; filename="${filename(input.scope, input.format)}"`, "content-length": String(bytes.byteLength), "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid boolean query parameter") return new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Invalid export request", requestId } }), { status: 400, headers: { "content-type": "application/json", "x-request-id": requestId } });
    return jsonError(error, requestId);
  }
}
