import Link from "next/link";
import { getMonthlyRegularTotal, listSubscriptions, getUsageSummary } from "@model-monitor/database";
import { db } from "@/lib/db";

function formatCost(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function DashboardPage() {
  const [cost, subs, usage] = await Promise.all([
    getMonthlyRegularTotal(db),
    listSubscriptions(db, { limit: 100 }),
    getUsageSummary(db),
  ]);

  const activeCount = subs.data.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-6" data-testid="kpi-active-subs">
          <p className="text-sm text-muted-foreground">Active subscriptions</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6" data-testid="kpi-monthly-cost">
          <p className="text-sm text-muted-foreground">Monthly fixed cost</p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            ${formatCost(cost.total)} {cost.currency}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6" data-testid="kpi-canonical-models">
          <p className="text-sm text-muted-foreground">Canonical models</p>
          <p className="mt-2">
            <Link
              href="/models"
              className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              View library &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* Renewal panel */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">Subscriptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Account
                </th>
                <th scope="col" className="px-4 py-2">
                  Plan
                </th>
                <th scope="col" className="px-4 py-2">
                  Status
                </th>
                <th scope="col" className="px-4 py-2">
                  Next billing
                </th>
              </tr>
            </thead>
            <tbody>
              {subs.data.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subs.data.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-t border-border hover:bg-muted/20"
                    data-testid="subscription-row"
                  >
                    <td className="px-4 py-2 font-medium text-foreground">
                      {sub.accountLabel}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {sub.planId.slice(0, 8)}&hellip;
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded border border-border px-1.5 py-0.5 text-xs">
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {sub.nextBillingDate ? (
                        <span data-testid="renewal-date">{sub.nextBillingDate}</span>
                      ) : (
                        <span data-testid="renewal-unknown">Unknown</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage / mock panel */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold text-foreground">Usage</h2>
        {usage.total === 0 ? (
          <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
        ) : usage.withMock ? (
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
              data-testid="mock-usage-badge"
            >
              <span
                className="flex h-2 w-2 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              <span className="text-sm font-medium text-foreground">
                Mock usage present
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {usage.mock} mock snapshot{usage.mock !== 1 ? "s" : ""} and{" "}
              {usage.total - usage.mock} real snapshot
              {usage.total - usage.mock !== 1 ? "s" : ""} recorded.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {usage.total} snapshot{usage.total !== 1 ? "s" : ""} recorded (all real data).
          </p>
        )}
      </div>
    </div>
  );
}
