import { restoreModel } from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk } from "@/lib/api";

interface RouteContext {
  params: Promise<{ modelId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { modelId } = await context.params;
    const model = await restoreModel(db, modelId, auditContext(request));
    return jsonOk(model, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
