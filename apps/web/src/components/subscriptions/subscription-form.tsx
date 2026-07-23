"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subscriptionWriteSchema } from "@model-monitor/schemas";
import type { z } from "zod";

const formSchema = subscriptionWriteSchema;
type FormValues = z.infer<typeof formSchema>;

interface Plan {
  id: string;
  name: string;
  accessProvider: {
    name: string;
  };
}

interface Props {
  mode: "create" | "edit";
  plans: Plan[];
  initial?: Partial<FormValues> & {
    id?: string;
  };
}

export function SubscriptionForm({ mode, plans, initial }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults = useMemo<FormValues>(
    () => ({
      planId: initial?.planId ?? plans[0]?.id ?? "",
      accountLabel: initial?.accountLabel ?? "",
      status: initial?.status ?? "active",
      startedAt: initial?.startedAt ?? null,
      nextBillingDate: initial?.nextBillingDate ?? null,
      autoRenews: initial?.autoRenews ?? null,
      actualPrice: initial?.actualPrice ?? null,
      currency: initial?.currency ?? "USD",
      billingInterval: initial?.billingInterval ?? null,
      usageTrackingMode: initial?.usageTrackingMode ?? "manual",
      usageCheckUrl: initial?.usageCheckUrl ?? null,
      usageCheckInstructions: initial?.usageCheckInstructions ?? null,
      importance: initial?.importance ?? null,
      notes: initial?.notes ?? null,
    }),
    [plans, initial],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  async function save(values: FormValues) {
    setServerError(null);

    const res = await fetch(
      mode === "create" ? "/api/v1/subscriptions" : `/api/v1/subscriptions/${initial?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setServerError(body?.error?.message ?? "Save failed");
      return;
    }

    const subscription = (await res.json()) as { id: string };
    router.push(`/subscriptions/${subscription.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(save)}
      className="mx-auto max-w-3xl space-y-6"
      data-testid="subscription-form"
      noValidate
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Account label" error={errors.accountLabel?.message} htmlFor="field-account-label">
          <input
            id="field-account-label"
            {...register("accountLabel")}
            aria-invalid={errors.accountLabel ? true : undefined}
            aria-describedby={errors.accountLabel ? "field-account-label-error" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-account-label"
          />
        </Field>

        <Field label="Plan" error={errors.planId?.message} htmlFor="field-plan-id">
          <select
            id="field-plan-id"
            {...register("planId")}
            aria-invalid={errors.planId ? true : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-plan-id"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.accessProvider.name} — {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status" error={errors.status?.message} htmlFor="field-status">
          <select
            id="field-status"
            {...register("status")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-status"
          >
            {["active", "paused", "cancelled", "expired", "trial"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Actual price" error={errors.actualPrice?.message} htmlFor="field-actual-price">
          <input
            id="field-actual-price"
            type="number"
            step="any"
            {...register("actualPrice", {
              setValueAs: (v: string) => (v === "" ? null : Number(v)),
            })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-actual-price"
          />
        </Field>

        <Field label="Currency" error={errors.currency?.message} htmlFor="field-currency">
          <input
            id="field-currency"
            {...register("currency")}
            maxLength={3}
            placeholder="USD"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-currency"
          />
        </Field>

        <Field label="Billing interval" htmlFor="field-billing-interval">
          <input
            id="field-billing-interval"
            {...register("billingInterval")}
            placeholder="e.g. monthly, yearly"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-billing-interval"
          />
        </Field>

        <Field label="Next billing date" htmlFor="field-next-billing-date">
          <input
            id="field-next-billing-date"
            type="date"
            {...register("nextBillingDate")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-next-billing-date"
          />
        </Field>

        <Field label="Started at" htmlFor="field-started-at">
          <input
            id="field-started-at"
            type="date"
            {...register("startedAt")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-started-at"
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Usage tracking mode" htmlFor="field-usage-tracking-mode">
          <select
            id="field-usage-tracking-mode"
            {...register("usageTrackingMode")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-usage-tracking-mode"
          >
            {["manual", "mock", "estimated", "provider_reported", "hybrid"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Usage check URL" htmlFor="field-usage-check-url">
          <input
            id="field-usage-check-url"
            type="url"
            {...register("usageCheckUrl")}
            placeholder="https://"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-usage-check-url"
          />
        </Field>

        <Field label="Auto-renews" htmlFor="field-auto-renews">
          <label className="flex items-center gap-2 pt-1">
            <input
              id="field-auto-renews"
              type="checkbox"
              {...register("autoRenews")}
              className="rounded border-border"
              data-testid="field-auto-renews"
            />
            <span className="text-sm">Auto-renews</span>
          </label>
        </Field>
      </div>

      <Field label="Usage check instructions" htmlFor="field-usage-check-instructions">
        <textarea
          id="field-usage-check-instructions"
          {...register("usageCheckInstructions")}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="field-usage-check-instructions"
        />
      </Field>

      <Field label="Notes" htmlFor="field-notes">
        <textarea
          id="field-notes"
          {...register("notes")}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="field-notes"
        />
      </Field>

      {serverError ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="form-error"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="subscription-form-submit"
        >
          {isSubmitting ? "Saving…" : mode === "create" ? "Create subscription" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="block space-y-1 text-xs">
      <label htmlFor={htmlFor} className="text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <span id={errorId} className="block text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
