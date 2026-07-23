import { getPlan } from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  getRequestId,
  jsonError,
  jsonOk,
  parsePathUuid,
  requireApiSession,
} from "@/lib/api";

interface RouteContext {
  params: Promise<{ planId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = getRequestId(_request);
  try {
    await requireApiSession(requestId);
    const { planId } = await context.params;
    const plan = await getPlan(db, parsePathUuid(planId, "planId"));
    return jsonOk(plan, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
