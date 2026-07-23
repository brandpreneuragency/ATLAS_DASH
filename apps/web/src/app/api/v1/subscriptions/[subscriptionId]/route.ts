import {
  archiveSubscription,
  getSubscription,
  updateSubscription,
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
  params: Promise<{ subscriptionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = getRequestId(_request);
  try {
    await requireApiSession(requestId);
    const { subscriptionId } = await context.params;
    const subscription = await getSubscription(
      db,
      parsePathUuid(subscriptionId, "subscriptionId"),
    );
    return jsonOk(subscription, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { subscriptionId } = await context.params;
    const body = await parseJsonBody(request);
    const subscription = await updateSubscription(
      db,
      parsePathUuid(subscriptionId, "subscriptionId"),
      body,
      auditContext(request, session.userId),
    );
    return jsonOk(subscription, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { subscriptionId } = await context.params;
    const subscription = await archiveSubscription(
      db,
      parsePathUuid(subscriptionId, "subscriptionId"),
      auditContext(request, session.userId),
    );
    return jsonOk(subscription, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
