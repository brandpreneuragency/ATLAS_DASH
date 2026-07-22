import { listDevelopers } from "@model-monitor/database";
import { db } from "@/lib/db";
import { getRequestId, jsonError, jsonOk } from "@/lib/api";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const data = await listDevelopers(db);
    return jsonOk({ data, meta: { requestId } }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
