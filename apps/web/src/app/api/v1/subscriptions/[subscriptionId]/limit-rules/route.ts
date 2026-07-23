import { createSubscriptionLimitRule } from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  auditContext,
  getRequestId,
  jsonError,
  jsonOk,
  parseJsonBody,
  requireApiSession,
} from "@/lib/api";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const body = await parseJsonBody(request);
    const rule = await createSubscriptionLimitRule(
      db,
      body,
      auditContext(request, session.userId),
    );
    return jsonOk(rule, { status: 201, requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
