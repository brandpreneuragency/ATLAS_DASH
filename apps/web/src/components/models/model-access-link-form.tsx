"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import type { modelAccessWriteSchema } from "@model-monitor/schemas";

type PlanOption = {
  id: string;
  name: string;
  slug: string;
  accessProvider: { id: string; name: string; slug: string };
};

type FormValues = z.infer<typeof modelAccessWriteSchema>;

interface Props {
  modelId: string;
  plans: PlanOption[];
}

function selectToTri(v: string): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function ModelAccessLinkForm({ modelId, plans }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [planId, setPlanId] = useState("");
  const [providerModelId, setProviderModelId] = useState("");
  const [availability, setAvailability] = useState("unconfirmed");
  const [accessMethod, setAccessMethod] = useState("");
  const [authenticationType, setAuthenticationType] = useState("other");
  const [includedInPlan, setIncludedInPlan] = useState("unknown");
  const [apiCompatible, setApiCompatible] = useState("unknown");
  const [cliOnly, setCliOnly] = useState(false);
  const [webOnly, setWebOnly] = useState(false);
  const [oauthSupported, setOauthSupported] = useState("unknown");
  const [priority, setPriority] = useState("");
  const [limitations, setLimitations] = useState("");

  function reset() {
    setPlanId("");
    setProviderModelId("");
    setAvailability("unconfirmed");
    setAccessMethod("");
    setAuthenticationType("other");
    setIncludedInPlan("unknown");
    setApiCompatible("unknown");
    setCliOnly(false);
    setWebOnly(false);
    setOauthSupported("unknown");
    setPriority("");
    setLimitations("");
    setServerError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!planId) {
      setServerError("Plan is required");
      return;
    }
    if (!accessMethod) {
      setServerError("Access method is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload: FormValues = {
        modelId,
        planId,
        providerModelId: providerModelId || null,
        availability: availability as FormValues["availability"],
        accessMethod: accessMethod as FormValues["accessMethod"],
        authenticationType: authenticationType as FormValues["authenticationType"],
        includedInPlan: selectToTri(includedInPlan),
        apiCompatible: selectToTri(apiCompatible),
        cliOnly,
        webOnly,
        oauthSupported: selectToTri(oauthSupported),
        priority: priority === "" ? null : Number(priority),
        limitations: limitations || null,
      };

      const res = await fetch("/api/v1/model-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setServerError(body?.error?.message ?? "Failed to create access link");
        return;
      }

      reset();
      router.refresh();
    } catch {
      setServerError("Unexpected error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-4 rounded-lg border border-border p-4"
      data-testid="model-access-link-form"
      noValidate
    >
      <h3 className="text-sm font-medium">Add access path</h3>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Plan */}
        <div className="space-y-1 text-xs">
          <label htmlFor="field-access-plan" className="text-muted-foreground">
            Plan *
          </label>
          <select
            id="field-access-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-access-plan"
            required
          >
            <option value="">Select a plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.accessProvider.name} — {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Provider model ID */}
        <div className="space-y-1 text-xs">
          <label htmlFor="field-access-provider-model" className="text-muted-foreground">
            Provider model ID
          </label>
          <input
            id="field-access-provider-model"
            type="text"
            value={providerModelId}
            onChange={(e) => setProviderModelId(e.target.value)}
            placeholder="e.g. gpt-4o (optional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-access-provider-model"
          />
        </div>

        {/* Availability */}
        <div className="space-y-1 text-xs">
          <label htmlFor="field-access-availability" className="text-muted-foreground">
            Availability
          </label>
          <select
            id="field-access-availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-access-availability"
          >
            <option value="confirmed">Confirmed</option>
            <option value="unconfirmed">Unconfirmed</option>
            <option value="unavailable">Unavailable</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        {/* Access method */}
        <div className="space-y-1 text-xs">
          <label htmlFor="field-access-method" className="text-muted-foreground">
            Access method *
          </label>
          <select
            id="field-access-method"
            value={accessMethod}
            onChange={(e) => setAccessMethod(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-access-method"
            required
          >
            <option value="">Select method</option>
            <option value="oauth">OAuth</option>
            <option value="provider_api">Provider API</option>
            <option value="direct_api">Direct API</option>
            <option value="cli">CLI</option>
            <option value="consumer_app">Consumer app</option>
            <option value="web">Web</option>
            <option value="self_hosted">Self-hosted</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Authentication type */}
        <div className="space-y-1 text-xs">
          <label htmlFor="field-access-auth-type" className="text-muted-foreground">
            Authentication type
          </label>
          <select
            id="field-access-auth-type"
            value={authenticationType}
            onChange={(e) => setAuthenticationType(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-access-auth-type"
          >
            <option value="oauth_subscription">OAuth subscription</option>
            <option value="api_key">API key</option>
            <option value="consumer_subscription">Consumer subscription</option>
            <option value="cli_session">CLI session</option>
            <option value="none">None</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-1 text-xs">
          <label htmlFor="field-access-priority" className="text-muted-foreground">
            Priority
          </label>
          <input
            id="field-access-priority"
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            placeholder="numeric priority"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-access-priority"
          />
        </div>
      </div>

      {/* Tri-state checkboxes row */}
      <div className="grid gap-3 md:grid-cols-3">
        <TriSelect
          label="Included in plan"
          value={includedInPlan}
          onChange={setIncludedInPlan}
          testId="field-access-included-in-plan"
        />
        <TriSelect
          label="API compatible"
          value={apiCompatible}
          onChange={setApiCompatible}
          testId="field-access-api-compatible"
        />
        <TriSelect
          label="OAuth supported"
          value={oauthSupported}
          onChange={setOauthSupported}
          testId="field-access-oauth-supported"
        />
      </div>

      {/* Boolean checkboxes */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={cliOnly}
            onChange={(e) => setCliOnly(e.target.checked)}
            data-testid="field-access-cli-only"
          />
          CLI only
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={webOnly}
            onChange={(e) => setWebOnly(e.target.checked)}
            data-testid="field-access-web-only"
          />
          Web only
        </label>
      </div>

      {/* Limitations */}
      <div className="space-y-1 text-xs">
        <label htmlFor="field-access-limitations" className="text-muted-foreground">
          Limitations
        </label>
        <textarea
          id="field-access-limitations"
          rows={2}
          value={limitations}
          onChange={(e) => setLimitations(e.target.value)}
          placeholder="Usage limits, rate limits, or restrictions"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="field-access-limitations"
        />
      </div>

      {serverError ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="model-access-link-error"
          role="alert"
          aria-live="assertive"
        >
          {serverError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="model-access-link-submit"
        >
          {submitting ? "Adding…" : "Add access path"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Reset
        </button>
      </div>
    </form>
  );
}

function TriSelect({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <div className="space-y-1 text-xs">
      <label htmlFor={testId} className="text-muted-foreground">
        {label}
      </label>
      <select
        id={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        data-testid={testId}
      >
        <option value="unknown">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}
