import {
  getMonthlyRegularTotal,
  getUsageSummary,
  listSubscriptions,
} from "@model-monitor/database";
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

    const [cost, usage, subsResult] = await Promise.all([
      getMonthlyRegularTotal(db),
      getUsageSummary(db),
      listSubscriptions(db, { limit: 100 }),
    ]);

    const subscriptions = subsResult.data.map((sub) => ({
      id: sub.id,
      accountLabel: sub.accountLabel,
      status: sub.status,
      nextBillingDate: sub.nextBillingDate,
    }));

    return jsonOk(
      {
        data: {
          monthlyRegularTotal: cost.total,
          currency: cost.currency,
          subscriptionCount: cost.subscriptionCount,
          byStatus: cost.byStatus,
          usage,
          subscriptions,
        },
        meta: { requestId },
      },
      { requestId },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}
