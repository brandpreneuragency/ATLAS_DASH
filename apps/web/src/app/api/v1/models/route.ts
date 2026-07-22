import {
  createModel,
  listModels,
} from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk } from "@/lib/api";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const result = await listModels(db, params);
    return jsonOk(
      {
        ...result,
        meta: { requestId },
      },
      { requestId },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body: unknown = await request.json();
    const model = await createModel(db, body, auditContext(request));
    return jsonOk(model, { status: 201, requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
