import {
  archiveModel,
  getModelById,
  updateModel,
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
  params: Promise<{ modelId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = getRequestId(_request);
  try {
    await requireApiSession(requestId);
    const { modelId } = await context.params;
    const model = await getModelById(db, parsePathUuid(modelId, "modelId"));
    return jsonOk(model, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { modelId } = await context.params;
    const body = await parseJsonBody(request);
    const model = await updateModel(
      db,
      parsePathUuid(modelId, "modelId"),
      body,
      auditContext(request, session.userId),
    );
    return jsonOk(model, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { modelId } = await context.params;
    await archiveModel(
      db,
      parsePathUuid(modelId, "modelId"),
      auditContext(request, session.userId),
    );
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
