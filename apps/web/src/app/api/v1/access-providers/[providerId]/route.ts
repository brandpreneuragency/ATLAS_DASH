import { getAccessProvider } from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  getRequestId,
  jsonError,
  jsonOk,
  parsePathUuid,
  requireApiSession,
} from "@/lib/api";

interface RouteContext {
  params: Promise<{ providerId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = getRequestId(_request);
  try {
    await requireApiSession(requestId);
    const { providerId } = await context.params;
    const provider = await getAccessProvider(
      db,
      parsePathUuid(providerId, "providerId"),
    );
    return jsonOk(provider, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
