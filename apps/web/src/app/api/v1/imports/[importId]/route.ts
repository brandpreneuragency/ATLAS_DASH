import { getImportJob, getPreview } from "@model-monitor/database";
import { getRequestId, jsonError, jsonOk, parsePathUuid, requireApiSession } from "@/lib/api";
import { db } from "@/lib/db";
import { buildImportPlan } from "@/lib/import-pipeline";

export async function GET(request: Request, context: { params: Promise<{ importId: string }> }) {
  const requestId = getRequestId(request);
  try {
    await requireApiSession(requestId);
    const { importId } = await context.params;
    const id = parsePathUuid(importId, "importId");
    const job = await getImportJob(db, id);
    const storedPreview = await getPreview(db, id);
    const built = await buildImportPlan(job.storedPath);
    const rows = [
      ...built.plan.modelRows.map((row: (typeof built.plan.modelRows)[number]) => ({ classification: row.classification === "error" ? "error" as const : row.classification, entityType: "model", sourceSheet: row.sourceSheet ?? undefined, sourceRow: row.sourceRow ?? undefined, label: row.name ?? undefined, proposedValues: { canonicalId: row.canonicalId, name: row.name, developer: row.developerName, subscriptionUsdMo: row.subscriptionUsdMo } })),
      ...built.plan.benchmarkRows.map((row: (typeof built.plan.benchmarkRows)[number]) => ({ classification: "create" as const, entityType: "benchmark", label: row.benchmarkName, proposedValues: row })),
    ];
    return jsonOk({ ...storedPreview, summary: built.summary, rows, conflicts: storedPreview.conflicts }, { requestId });
  } catch (error) {
    return jsonError(error, requestId, "Unable to read import");
  }
}
