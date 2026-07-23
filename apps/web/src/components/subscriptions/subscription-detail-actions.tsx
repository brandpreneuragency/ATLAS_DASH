"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  id: string;
  status: string;
}

export function SubscriptionDetailActions({ id, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isArchived = status === "archived";

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/subscriptions/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Restore failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Archive failed");
      }
      setConfirmArchive(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {isArchived ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void restore()}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
            data-testid="subscription-restore-button"
          >
            {busy ? "Working…" : "Restore"}
          </button>
        ) : (
          <>
            <a
              href={`/subscriptions/${id}/edit`}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              data-testid="subscription-edit-link"
            >
              Edit
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmArchive(true)}
              className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
              data-testid="subscription-archive-button"
            >
              Archive
            </button>
          </>
        )}
      </div>

      {confirmArchive ? (
        <div
          className="w-full max-w-sm space-y-2 rounded-md border border-amber-500/40 bg-background p-4 text-sm shadow-lg"
          data-testid="archive-confirm-dialog"
        >
          <p className="font-medium">Archive this subscription?</p>
          <p className="text-muted-foreground">
            The subscription will be hidden from the default view. You can restore it later.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              data-testid="archive-confirm"
              onClick={() => void archive()}
            >
              {busy ? "Archiving…" : "Confirm archive"}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
              data-testid="archive-cancel"
              onClick={() => setConfirmArchive(false)}
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p
              className="text-xs text-destructive"
              role="alert"
              aria-live="assertive"
              data-testid="archive-dialog-error"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {error && !confirmArchive ? (
        <p className="text-xs text-destructive" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
