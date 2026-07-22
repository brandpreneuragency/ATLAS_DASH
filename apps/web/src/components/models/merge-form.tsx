"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ModelOption {
  id: string;
  name: string;
  canonicalId: string;
}

export function MergeForm({
  models,
  initialSourceId,
  initialTargetId,
}: {
  models: ModelOption[];
  initialSourceId?: string;
  initialTargetId?: string;
}) {
  const router = useRouter();
  const [sourceModelId, setSourceModelId] = useState(initialSourceId ?? "");
  const [targetModelId, setTargetModelId] = useState(initialTargetId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/models/merge", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ sourceModelId, targetModelId }),
      });
      const body = (await res.json()) as {
        targetModelId?: string;
        transferred?: Record<string, number>;
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(body.error?.message ?? "Merge failed");
      }
      setResult(
        `Merged into ${body.targetModelId}. Transferred: ${JSON.stringify(body.transferred)}`,
      );
      router.push(`/models/${body.targetModelId}?tab=history`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" data-testid="merge-form">
      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">Source model (will be archived)</span>
        <select
          required
          value={sourceModelId}
          onChange={(e) => setSourceModelId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="merge-source"
        >
          <option value="">Select source…</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.canonicalId})
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span className="text-muted-foreground">Target model (survives)</span>
        <select
          required
          value={targetModelId}
          onChange={(e) => setTargetModelId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="merge-target"
        >
          <option value="">Select target…</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.canonicalId})
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="text-sm text-destructive" data-testid="merge-error">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="text-sm text-muted-foreground" data-testid="merge-result">
          {result}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || !sourceModelId || !targetModelId}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        data-testid="merge-submit"
      >
        {busy ? "Merging…" : "Merge transactionally"}
      </button>
    </form>
  );
}
