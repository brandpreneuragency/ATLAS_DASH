"use client";


import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  const [confirmed, setConfirmed] = useState(false);
  /** One production key per intended merge; reused on uncertain retries. */
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const source = useMemo(
    () => models.find((m) => m.id === sourceModelId) ?? null,
    [models, sourceModelId],
  );
  const target = useMemo(
    () => models.find((m) => m.id === targetModelId) ?? null,
    [models, targetModelId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!sourceModelId || !targetModelId) {
      setError("Source and target models are required");
      return;
    }
    if (sourceModelId === targetModelId) {
      setError("Source and target must be different models");
      return;
    }
    if (!confirmed) {
      setError("Review the merge impact summary and confirm before continuing");
      return;
    }

    setBusy(true);
    try {
      const payload = { sourceModelId, targetModelId };
      // Reuse the same key for retries of this intended submission; mint a new key only
      // when source/target change (handled below via effect on select change).
      let key = idempotencyKey;
      if (!key) {
        key = `mm:merge:${crypto.randomUUID()}`;
        setIdempotencyKey(key);
      }
      const res = await fetch("/api/v1/models/merge", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as {
        targetModelId?: string;
        transferred?: Record<string, number>;
        error?: { message?: string };
      };
      if (!res.ok) {
        // Keep key for uncertain/retryable failures so the same payload retries replay.
        throw new Error(body.error?.message ?? "Merge failed");
      }
      setResult(
        `Merged into ${body.targetModelId}. Transferred: ${JSON.stringify(body.transferred)}`,
      );
      // Successful new operation consumes the key; next merge gets a fresh one.
      setIdempotencyKey(null);
      router.push(`/models/${body.targetModelId}?tab=history`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" data-testid="merge-form" noValidate>
      <label className="block space-y-1 text-xs" htmlFor="merge-source">
        <span className="text-muted-foreground">Source model (will be archived)</span>
        <select
          id="merge-source"
          required
          value={sourceModelId}
          onChange={(e) => {
            setSourceModelId(e.target.value);
            setConfirmed(false);
            setIdempotencyKey(null);
          }}
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
      <label className="block space-y-1 text-xs" htmlFor="merge-target">
        <span className="text-muted-foreground">Target model (survives)</span>
        <select
          id="merge-target"
          required
          value={targetModelId}
          onChange={(e) => {
            setTargetModelId(e.target.value);
            setConfirmed(false);
            setIdempotencyKey(null);
          }}
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

      {source && target && source.id !== target.id ? (
        <div
          className="space-y-2 rounded-md border border-border bg-muted/30 p-4 text-sm"
          data-testid="merge-impact-summary"
          role="region"
          aria-labelledby="merge-impact-title"
        >
          <h2 id="merge-impact-title" className="font-medium">
            Merge impact summary
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              Source (archived after merge):{" "}
              <strong className="text-foreground">
                {source.name} ({source.canonicalId})
              </strong>
            </li>
            <li>
              Target (survives):{" "}
              <strong className="text-foreground">
                {target.name} ({target.canonicalId})
              </strong>
            </li>
            <li>Aliases from the source transfer to the target (duplicates skipped).</li>
            <li>Access paths, benchmarks, scores, sources, and provenance transfer to the target.</li>
            <li>History is retained; the source record is archived with a merge pointer.</li>
            <li data-testid="merge-no-independent-restore">
              The archived merged source <strong className="text-foreground">cannot be restored independently</strong>.
              Only the surviving target model remains editable/restorable as the canonical identity.
            </li>
          </ul>
          <label className="flex items-start gap-2 pt-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              data-testid="merge-confirm"
              className="mt-1"
            />
            <span>
              I understand the source will be archived, relationships move to the target, and the
              merged source cannot be restored on its own.
            </span>
          </label>
        </div>
      ) : null}

      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="merge-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="text-sm text-muted-foreground" data-testid="merge-result" role="status">
          {result}
        </p>
      ) : null}
      {idempotencyKey ? (
        <input type="hidden" data-testid="merge-idempotency-key" value={idempotencyKey} readOnly />
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
