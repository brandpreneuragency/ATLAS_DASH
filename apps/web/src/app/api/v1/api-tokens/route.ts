import { createApiToken, listApiTokens, ModelServiceError, safeApiTokenResponse } from "@model-monitor/database";
import { createApiTokenSchema } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk, parseJsonBody, requireApiSession } from "@/lib/api";

export async function GET(request: Request) { const requestId = getRequestId(request); try { const session = await requireApiSession(requestId); if (!session.userId) throw new ModelServiceError("UNAUTHORIZED", "Authenticated user id required", 401); return jsonOk({ data: await listApiTokens(db, session.userId), meta: { requestId } }, { requestId }); } catch (e) { return jsonError(e, requestId); } }
export async function POST(request: Request) { const requestId = getRequestId(request); try { const session = await requireApiSession(requestId); if (!session.userId) throw new ModelServiceError("UNAUTHORIZED", "Authenticated user id required", 401); const parsed = createApiTokenSchema.parse(await parseJsonBody(request)); const result = await createApiToken(db, session.userId, parsed, auditContext(request, session.userId)); return jsonOk(safeApiTokenResponse(result, result.token), { status: 201, requestId }); } catch (e) { return jsonError(e, requestId); } }
