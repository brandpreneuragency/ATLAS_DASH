import { resolveConflicts } from "@model-monitor/database";
import {
  auditContext,
  getRequestId,
  jsonError,
  jsonOk,
  parseJsonBody,
  parsePathUuid,
  requireApiSession,
} from "@/lib/api";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ importId: string }> },
) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const { importId } = await context.params;
    const id = parsePathUuid(importId, "importId");
    const body = await parseJsonBody(request);
    const conflicts = await resolveConflicts(
      db,
      id,
      body,
      auditContext(request, session.userId),
    );
    return jsonOk({ conflicts }, { requestId });
  } catch (error) {
    return jsonError(error, requestId, "Unable to resolve conflicts");
  }
}
