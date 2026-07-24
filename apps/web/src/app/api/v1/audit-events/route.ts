import { listAuditEvents } from "@model-monitor/database";
import { auditQuerySchema } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { getRequestId, jsonError, jsonOk, requireApiSession } from "@/lib/api";
export async function GET(request: Request) { const requestId = getRequestId(request); try { await requireApiSession(requestId); const query = auditQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)); const result = await listAuditEvents(db, query); return jsonOk({ ...result, meta: { ...result.meta, requestId } }, { requestId }); } catch (e) { return jsonError(e, requestId); } }
