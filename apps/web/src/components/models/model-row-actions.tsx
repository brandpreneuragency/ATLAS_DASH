"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  id: string;
  status: string;
  name: string;
  mergedIntoModelId?: string | null;
}

export function ModelRowActions({ id, status, name, mergedIntoModelId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isMerged = Boolean(mergedIntoModelId);

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/models/${id}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/models/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Archive failed");
      setConfirmArchive(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Link href={`/models/${id}`} className="text-xs underline">
          Open
        </Link>
        {isMerged ? (
          <Link
            href={`/models/${mergedIntoModelId}`}
            className="text-xs underline"
            data-testid={`merged-into-${id}`}
          >
            Merged target
          </Link>
        ) : (
          <Link href={`/models/${id}/edit`} className="text-xs underline" data-testid={`edit-${id}`}>
            Edit
          </Link>
        )}
        {isMerged ? null : status === "archived" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void restore()}
            className="text-xs underline disabled:opacity-50"
            data-testid={`archive-toggle-${id}`}
            aria-label={`Restore ${name}`}
          >
            Restore
          </button>
        ) : confirmArchive ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void archive()}
              className="text-xs font-medium underline disabled:opacity-50"
              data-testid={`archive-confirm-${id}`}
              aria-label={`Confirm archive ${name}`}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive(false)}
              className="text-xs underline"
              data-testid={`archive-cancel-${id}`}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmArchive(true)}
            className="text-xs underline disabled:opacity-50"
            data-testid={`archive-toggle-${id}`}
            aria-label={`Archive ${name}`}
          >
            Archive
          </button>
        )}
      </div>
      {error ? (
        <span className="text-xs text-destructive" role="alert" aria-live="assertive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
