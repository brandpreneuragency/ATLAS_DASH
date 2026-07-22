import {
  archiveModel,
  getModelById,
  updateModel,
} from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk } from "@/lib/api";

interface RouteContext {
  params: Promise<{ modelId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = getRequestId(_request);
  try {
    const { modelId } = await context.params;
    const model = await getModelById(db, modelId);
    return jsonOk(model, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { modelId } = await context.params;
    const body: unknown = await request.json();
    const model = await updateModel(db, modelId, body, auditContext(request));
    return jsonOk(model, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { modelId } = await context.params;
    await archiveModel(db, modelId, auditContext(request));
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
