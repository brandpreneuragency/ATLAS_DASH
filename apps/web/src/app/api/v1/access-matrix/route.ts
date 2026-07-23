import { getAccessMatrix } from "@model-monitor/database";
import { db } from "@/lib/db";
import {
  getRequestId,
  jsonError,
  jsonOk,
  requireApiSession,
} from "@/lib/api";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireApiSession(requestId);
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const parsed: Record<string, unknown> = {};
    if (raw.search) parsed.search = raw.search;
    if (raw.developer) parsed.developer = raw.developer;
    if (raw.accessProvider) parsed.accessProvider = raw.accessProvider;
    if (raw.availability) parsed.availability = raw.availability;
    if (raw.cliOnly !== undefined) parsed.cliOnly = raw.cliOnly;
    if (raw.limit) parsed.limit = raw.limit;
    const data = await getAccessMatrix(db, parsed);
    return jsonOk({ data, meta: { requestId } }, { requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
