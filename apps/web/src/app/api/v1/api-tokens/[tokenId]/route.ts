import { ModelServiceError, revokeApiToken } from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk, parsePathUuid, requireApiSession } from "@/lib/api";
export async function DELETE(request: Request, context: { params: Promise<{ tokenId: string }> }) { const requestId = getRequestId(request); try { const session = await requireApiSession(requestId); if (!session.userId) throw new ModelServiceError("UNAUTHORIZED", "Authenticated user id required", 401); const { tokenId } = await context.params; return jsonOk(await revokeApiToken(db, session.userId, parsePathUuid(tokenId, "tokenId"), auditContext(request, session.userId).requestId), { requestId }); } catch (e) { return jsonError(e, requestId); } }
