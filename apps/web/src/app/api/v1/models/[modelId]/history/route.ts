import { getModelById } from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  getRequestId,
  jsonError,
  jsonOk,
  parsePathUuid,
  requireApiSession,
} from "@/lib/api";

interface RouteContext {
  params: Promise<{ modelId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    await requireApiSession(requestId);
    const { modelId } = await context.params;
    const model = await getModelById(db, parsePathUuid(modelId, "modelId"));
    return jsonOk(
      {
        data: model.history,
        meta: { requestId },
      },
      { requestId },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
