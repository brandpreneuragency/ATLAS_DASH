import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubscription } from "@model-monitor/database";
import { db } from "@/lib/db";
import { SubscriptionDetailActions } from "@/components/subscriptions/subscription-detail-actions";

interface Props {
  params: Promise<{ subscriptionId: string }>;
}

export default async function SubscriptionDetailPage({ params }: Props) {
  const { subscriptionId } = await params;

  let subscription;
  try {
    subscription = await getSubscription(db, subscriptionId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6" data-testid="subscription-detail">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <Link href="/subscriptions" className="hover:underline">
              Subscriptions
            </Link>{" "}
            / {subscription.accountLabel}
          </div>
          <h1 className="text-2xl font-bold" data-testid="subscription-detail-label">
            {subscription.accountLabel}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded border border-border px-1.5 py-0.5 text-xs uppercase">
              {subscription.status}
            </span>
            <span>{subscription.plan.name}</span>
            <span className="text-xs">{subscription.plan.accessProviderName}</span>
          </div>
        </div>
        <SubscriptionDetailActions id={subscription.id} status={subscription.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Status">{subscription.status}</Card>
        <Card title="Plan">
          {subscription.plan.name}
          <div className="text-xs text-muted-foreground">{subscription.plan.accessProviderName}</div>
        </Card>
        <Card title="Next billing">
          {subscription.nextBillingDate ?? "Unknown"}
        </Card>
        <Card title="Price">
          {subscription.actualPrice == null
            ? "—"
            : `${subscription.currency ?? "USD"} ${subscription.actualPrice}`}
        </Card>
        <Card title="Billing interval">
          {subscription.billingInterval ?? "—"}
        </Card>
        <Card title="Auto-renews">
          {subscription.autoRenews == null ? "Unknown" : subscription.autoRenews ? "Yes" : "No"}
        </Card>
        <Card title="Usage tracking mode">
          {subscription.usageTrackingMode}
        </Card>
        <Card title="Usage check URL">
          {subscription.usageCheckUrl ? (
            <span className="break-all text-xs">{subscription.usageCheckUrl}</span>
          ) : (
            "—"
          )}
        </Card>
      </div>

      <Card title="Usage check instructions">
        {subscription.usageCheckInstructions ?? "—"}
      </Card>

      <Card title="Notes">
        {subscription.notes ?? "—"}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
