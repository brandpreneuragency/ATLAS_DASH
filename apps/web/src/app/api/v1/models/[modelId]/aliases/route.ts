import { addModelAlias } from "@model-monitor/database";
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

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { modelId } = await context.params;
    const body = await parseJsonBody(request);
    const alias = await addModelAlias(
      db,
      parsePathUuid(modelId, "modelId"),
      body,
      auditContext(request, session.userId),
    );
    return jsonOk(alias, { status: 201, requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
