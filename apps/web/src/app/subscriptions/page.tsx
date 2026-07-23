import Link from "next/link";
import { listPlans, listSubscriptions } from "@model-monitor/database";
import { db } from "@/lib/db";

interface SubscriptionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function SubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
  const params = await searchParams;
  const query = {
    search: first(params.search),
    status: first(params.status),
    archived: first(params.archived),
    sort: first(params.sort) ?? "accountLabel",
    page: first(params.page) ?? "1",
    limit: first(params.limit) ?? "50",
  };

  const [result, allPlans] = await Promise.all([
    listSubscriptions(db, query),
    listPlans(db, {}),
  ]);
  const planMap = new Map(allPlans.map((p) => [p.id, p]));
  const page = result.page.page ?? 1;
  const totalPages = Math.max(1, Math.ceil((result.page.total ?? 0) / (result.page.pageSize ?? 50)));

  return (
    <div className="space-y-6" data-testid="subscriptions-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            {result.page.total ?? result.data.length} subscription{result.page.total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/subscriptions/new"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            data-testid="subscription-create-link"
          >
            New subscription
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm" data-testid="subscriptions-table">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-muted/40 px-3 py-2">
                Account
              </th>
              <th scope="col" className="px-3 py-2">
                Plan
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Next billing
              </th>
              <th scope="col" className="px-3 py-2">
                Monthly price
              </th>
              <th scope="col" className="px-3 py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {result.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground" data-testid="subscriptions-empty">
                  No subscriptions yet.
                </td>
              </tr>
            ) : (
              result.data.map((sub) => {
                const plan = planMap.get(sub.planId);
                return (
                  <tr key={sub.id} className="border-t border-border hover:bg-muted/20" data-testid="subscription-row">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <Link
                        href={`/subscriptions/${sub.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {sub.accountLabel}
                      </Link>
                      {sub.status === "archived" ? (
                        <span className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          archived
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {plan ? `${plan.accessProvider.name} / ${plan.name}` : sub.planId}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="px-3 py-2">{sub.nextBillingDate ?? "Unknown"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {sub.actualPrice == null ? "—" : sub.currency ? `${sub.currency} ${sub.actualPrice}` : String(sub.actualPrice)}
                    </td>
                    <td className="px-3 py-2">
                      <SubscriptionRowActions id={sub.id} status={sub.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(query, page - 1)}
              className="rounded border border-border px-3 py-1.5 hover:bg-accent"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={buildPageHref(query, page + 1)}
              className="rounded border border-border px-3 py-1.5 hover:bg-accent"
              data-testid="subscriptions-next-page"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "border-emerald-500/40 text-emerald-300"
      : status === "paused"
        ? "border-amber-500/40 text-amber-300"
        : status === "cancelled" || status === "expired"
          ? "border-rose-500/40 text-rose-300"
          : "border-border text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${cls}`}>
      {status}
    </span>
  );
}

function SubscriptionRowActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/subscriptions/${id}`} className="text-xs underline">
        Open
      </Link>
      {status !== "archived" ? (
        <Link href={`/subscriptions/${id}/edit`} className="text-xs underline" data-testid={`edit-${id}`}>
          Edit
        </Link>
      ) : null}
    </div>
  );
}

function buildPageHref(
  query: Record<string, string | undefined>,
  page: number,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (!v || k === "page") continue;
    sp.set(k, v);
  }
  sp.set("page", String(page));
  return `/subscriptions?${sp.toString()}`;
}
