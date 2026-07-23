import { listPlans } from "@model-monitor/database";
import { db } from "@/lib/db";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";

export default async function NewSubscriptionPage() {
  const plans = await listPlans(db, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create subscription</h1>
        <p className="text-sm text-muted-foreground">
          Add a subscription with billing, access type, and usage instructions.
        </p>
      </div>
      <SubscriptionForm mode="create" plans={plans} />
    </div>
  );
}
