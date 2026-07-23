"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  accessId: string;
}

export function ModelAccessArchiveButton({ accessId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/model-access/${accessId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Archive failed");
      }
      setConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void archive()}
          className="text-xs font-medium text-destructive underline disabled:opacity-50"
          data-testid={`archive-access-btn-${accessId}`}
        >
          {busy ? "Archiving…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="text-xs underline"
        >
          Cancel
        </button>
        {error ? (
          <span
            className="text-xs text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => setConfirm(true)}
      className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      data-testid={`archive-access-btn-${accessId}`}
    >
      Archive
    </button>
  );
}
