import {
  createModelAccess,
  listModelAccess,
} from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  auditContext,
  getRequestId,
  jsonError,
  jsonOk,
  parseJsonBody,
  requireApiSession,
} from "@/lib/api";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireApiSession(requestId);
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const result = await listModelAccess(db, params);
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
    const session = await requireApiSession(requestId);
    const body = await parseJsonBody(request);
    const model = await createModelAccess(
      db,
      body,
      auditContext(request, session.userId),
    );
    return jsonOk(model, { status: 201, requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
