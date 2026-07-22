"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  id: string;
  status: string;
  name: string;
}

export function ModelRowActions({ id, status, name }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archiveOrRestore() {
    setBusy(true);
    setError(null);
    try {
      if (status === "archived") {
        const res = await fetch(`/api/v1/models/${id}/restore`, { method: "POST" });
        if (!res.ok) throw new Error("Restore failed");
      } else {
        const res = await fetch(`/api/v1/models/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Archive failed");
      }
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
        <Link href={`/models/${id}/edit`} className="text-xs underline">
          Edit
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => void archiveOrRestore()}
          className="text-xs underline disabled:opacity-50"
          data-testid={`archive-toggle-${id}`}
          aria-label={status === "archived" ? `Restore ${name}` : `Archive ${name}`}
        >
          {status === "archived" ? "Restore" : "Archive"}
        </button>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
