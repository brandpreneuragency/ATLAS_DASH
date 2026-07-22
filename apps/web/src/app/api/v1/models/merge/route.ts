import { mergeModels } from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk } from "@/lib/api";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body: unknown = await request.json();
    const result = await mergeModels(db, body, auditContext(request));
    return jsonOk(result, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
