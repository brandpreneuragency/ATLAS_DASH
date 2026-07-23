import { notFound } from "next/navigation";
import { getSubscription, listPlans } from "@model-monitor/database";
import { db } from "@/lib/db";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import type { subscriptionWriteSchema } from "@model-monitor/schemas";
import type { z } from "zod";

interface Props {
  params: Promise<{ subscriptionId: string }>;
}

export default async function EditSubscriptionPage({ params }: Props) {
  const { subscriptionId } = await params;

  let subscription;
  try {
    subscription = await getSubscription(db, subscriptionId);
  } catch {
    notFound();
  }

  const plans = await listPlans(db, {});

  const initial: Partial<z.infer<typeof subscriptionWriteSchema>> & { id: string } = {
    id: subscription.id,
    planId: subscription.planId,
    accountLabel: subscription.accountLabel,
    status: subscription.status,
    startedAt: subscription.startedAt,
    nextBillingDate: subscription.nextBillingDate,
    autoRenews: subscription.autoRenews,
    actualPrice: subscription.actualPrice,
    currency: subscription.currency,
    billingInterval: subscription.billingInterval,
    usageTrackingMode: subscription.usageTrackingMode,
    usageCheckUrl: subscription.usageCheckUrl,
    usageCheckInstructions: subscription.usageCheckInstructions,
    notes: subscription.notes,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit subscription</h1>
        <p className="text-sm text-muted-foreground">{subscription.accountLabel}</p>
      </div>
      <SubscriptionForm mode="edit" plans={plans} initial={initial} />
    </div>
  );
}
