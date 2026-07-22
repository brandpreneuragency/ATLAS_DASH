import { addModelAlias } from "@model-monitor/database";
import { db } from "@/lib/db";
import { auditContext, getRequestId, jsonError, jsonOk } from "@/lib/api";

interface RouteContext {
  params: Promise<{ modelId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const { modelId } = await context.params;
    const body = (await request.json()) as {
      alias?: string;
      aliasType?: string;
      accessProviderId?: string | null;
    };
    const alias = await addModelAlias(
      db,
      modelId,
      {
        alias: body.alias ?? "",
        aliasType: body.aliasType,
        accessProviderId: body.accessProviderId,
      },
      auditContext(request),
    );
    return jsonOk(alias, { status: 201, requestId });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
