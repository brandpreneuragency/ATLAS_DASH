import {
  hashIdempotencyPayload,
  mergeModelsInTransaction,
  withIdempotency,
} from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  auditContext,
  getRequestId,
  jsonError,
  jsonOk,
  parseIdempotencyKey,
  parseJsonBody,
  requireApiSession,
} from "@/lib/api";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const session = await requireApiSession(requestId);
    const idempotencyKey = parseIdempotencyKey(request);
    const body = await parseJsonBody(request);
    const requestHash = hashIdempotencyPayload(body);

    const result = await withIdempotency(
      db,
      {
        key: idempotencyKey,
        operation: "models.merge",
        requestHash,
        successStatus: 200,
      },
      (tx) =>
        mergeModelsInTransaction(tx, body, auditContext(request, session.userId)),
    );

    const response = jsonOk(result.body, { status: result.status, requestId });
    if (result.replay) {
      response.headers.set("Idempotency-Replayed", "true");
    }
    return response;
  } catch (error) {
    return jsonError(error, requestId);
  }
}
