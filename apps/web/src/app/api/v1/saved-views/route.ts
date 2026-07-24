import { createSavedView, listSavedViews } from "@model-monitor/database";
import { savedViewSchema } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { ModelServiceError } from "@model-monitor/database";
import { auditContext, getRequestId, jsonError, jsonOk, parseJsonBody, requireApiSession } from "@/lib/api";
export async function GET(request: Request) { const requestId = getRequestId(request); try { const s = await requireApiSession(requestId); if (!s.userId) throw new ModelServiceError("UNAUTHORIZED", "Authenticated user id required", 401); return jsonOk({ data: await listSavedViews(db, s.userId), meta: { requestId } }, { requestId }); } catch (e) { return jsonError(e, requestId); } }
export async function POST(request: Request) { const requestId = getRequestId(request); try { const s = await requireApiSession(requestId); if (!s.userId) throw new ModelServiceError("UNAUTHORIZED", "Authenticated user id required", 401); const input = savedViewSchema.parse(await parseJsonBody(request)); return jsonOk(await createSavedView(db, s.userId, input, auditContext(request, s.userId).requestId), { status: 201, requestId }); } catch (e) { return jsonError(e, requestId); } }
