"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ModelDetailActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    try {
      const res =
        status === "archived"
          ? await fetch(`/api/v1/models/${id}/restore`, { method: "POST" })
          : await fetch(`/api/v1/models/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Request failed");
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
        <Link
          href={`/models/${id}/edit`}
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          data-testid="model-edit-link"
        >
          Edit
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleArchive()}
          className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
          data-testid="model-archive-button"
        >
          {status === "archived" ? "Restore" : "Archive"}
        </button>
        <Link
          href={`/models/merge?source=${id}`}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          Merge…
        </Link>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
