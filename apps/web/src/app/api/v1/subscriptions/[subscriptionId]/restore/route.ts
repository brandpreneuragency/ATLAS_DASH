import { restoreSubscription } from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  auditContext,
  getRequestId,
  jsonError,
  jsonOk,
  parsePathUuid,
  requireApiSession,
} from "@/lib/api";

interface RouteContext {
  params: Promise<{ subscriptionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { subscriptionId } = await context.params;
    const subscription = await restoreSubscription(
      db,
      parsePathUuid(subscriptionId, "subscriptionId"),
      auditContext(request, session.userId),
    );
    return jsonOk(subscription, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
