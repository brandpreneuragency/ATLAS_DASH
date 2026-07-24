import { ModelServiceError, getVerificationSettings, setVerificationSettings } from "@model-monitor/database";
import { verificationSettingsSchema } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk, parseJsonBody, requireApiSession } from "@/lib/api";
export async function GET(request: Request) { const requestId = getRequestId(request); try { await requireApiSession(requestId); return jsonOk({ data: await getVerificationSettings(db), meta: { requestId } }, { requestId }); } catch (e) { return jsonError(e, requestId); } }
export async function PATCH(request: Request) { const requestId = getRequestId(request); try { const session = await requireApiSession(requestId); if (!session.userId) throw new ModelServiceError("UNAUTHORIZED", "Authenticated user id required", 401); const input = verificationSettingsSchema.parse(await parseJsonBody(request)); return jsonOk({ data: await setVerificationSettings(db, session.userId, input, auditContext(request, session.userId).requestId), meta: { requestId } }, { requestId }); } catch (e) { return jsonError(e, requestId); } }
