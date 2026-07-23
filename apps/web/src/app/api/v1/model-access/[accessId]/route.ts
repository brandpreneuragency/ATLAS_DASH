import {
  archiveModelAccess,
  getModelAccess,
  updateModelAccess,
} from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  auditContext,
  getRequestId,
  jsonError,
  jsonOk,
  parseJsonBody,
  parsePathUuid,
  requireApiSession,
} from "@/lib/api";

interface RouteContext {
  params: Promise<{ accessId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    await requireApiSession(requestId);
    const { accessId } = await context.params;
    const result = await getModelAccess(db, parsePathUuid(accessId, "accessId"));
    return jsonOk({ ...result, meta: { requestId } }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { accessId } = await context.params;
    const body = await parseJsonBody(request);
    const result = await updateModelAccess(
      db,
      parsePathUuid(accessId, "accessId"),
      body,
      auditContext(request, session.userId),
    );
    return jsonOk({ ...result, meta: { requestId } }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { accessId } = await context.params;
    const result = await archiveModelAccess(
      db,
      parsePathUuid(accessId, "accessId"),
      auditContext(request, session.userId),
    );
    return jsonOk({ ...result, meta: { requestId } }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
