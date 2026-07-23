import {
  deleteSubscriptionLimitRule,
  updateSubscriptionLimitRule,
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
  params: Promise<{ subscriptionId: string; ruleId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { ruleId } = await context.params;
    const body = await parseJsonBody(request);
    const rule = await updateSubscriptionLimitRule(
      db,
      parsePathUuid(ruleId, "ruleId"),
      body,
      auditContext(request, session.userId),
    );
    return jsonOk(rule, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { ruleId } = await context.params;
    const result = await deleteSubscriptionLimitRule(
      db,
      parsePathUuid(ruleId, "ruleId"),
      auditContext(request, session.userId),
    );
    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
