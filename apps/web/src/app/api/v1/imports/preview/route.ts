import { createImportJob, storePreview, updateImportJobStatus, getImportJob } from "@model-monitor/database";
import { intakeWorkbook, storeFileUnder } from "@model-monitor/excel-import";
import { schema } from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk, requireApiSession } from "@/lib/api";
import { buildImportPlan } from "@/lib/import-pipeline";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const form = await request.formData();
    const entry = form.get("file");
    if (!(entry instanceof File)) throw new (await import("@model-monitor/database")).ModelServiceError("VALIDATION_ERROR", "File is required", 400);
    const buffer = Buffer.from(await entry.arrayBuffer());
    const base = process.env.IMPORT_STORAGE_DIR ?? join(process.cwd(), ".import-storage");
    await mkdir(base, { recursive: true });
    const intake = await intakeWorkbook(buffer, entry.name, { storeFile: storeFileUnder(base), maxBytes: Number(process.env.IMPORT_MAX_BYTES ?? 50 * 1024 * 1024) });
    const [fallback] = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
    const userId = session.userId ?? fallback?.id;
    if (!userId) throw new Error("No import user");
    const ctx = auditContext(request, userId);
    const job = await createImportJob(db, { userId, filename: entry.name, storedPath: intake.storedPath, sha256: intake.sha256, parserVersion: intake.parserVersion }, ctx);
    await updateImportJobStatus(db, job.id, { status: "parsing" }, ctx);
    const built = await buildImportPlan(intake.storedPath);
    await storePreview(db, job.id, { previewSummary: built.summary, conflicts: built.conflicts, errorSummary: { totalErrors: built.errors.length, errors: built.errors }, sheetSummary: built.sheets }, ctx);
    return jsonOk({ ...(await getImportJob(db, job.id)), preview: built.summary, conflicts: built.conflicts }, { status: 202, requestId });
  } catch (error) { return jsonError(error, requestId, "Import preview failed"); }
}
