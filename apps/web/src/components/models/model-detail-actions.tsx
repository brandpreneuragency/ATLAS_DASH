"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export function ModelDetailActions({
  id,
  status,
  name,
  mergedIntoModelId,
}: {
  id: string;
  status: string;
  name: string;
  mergedIntoModelId?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const isMerged = Boolean(mergedIntoModelId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmArchive) {
      if (!dialog.open) dialog.showModal();
      const focusable = dialog.querySelector<HTMLElement>(
        "button, [href], input, select, textarea",
      );
      focusable?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [confirmArchive]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function onClose() {
      setConfirmArchive(false);
      triggerRef.current?.focus();
    }
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  async function restore() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/models/${id}/restore`, { method: "POST" });
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
      const res = await fetch(`/api/v1/models/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? "Archive failed");
      }
      setConfirmArchive(false);
      router.refresh();
    } catch (err) {
      // Keep the dialog open and surface the error inside it so AT can reach it.
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {isMerged ? (
          <div
            className="rounded-md border border-border px-3 py-2 text-sm"
            data-testid="model-merged-state"
            role="status"
          >
            Merged into{" "}
            <Link
              href={`/models/${mergedIntoModelId}`}
              className="underline"
              data-testid="merged-into-link"
            >
              target model
            </Link>
            <span className="sr-only"> — cannot edit or restore independently</span>
          </div>
        ) : (
          <Link
            href={`/models/${id}/edit`}
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
            data-testid="model-edit-link"
          >
            Edit
          </Link>
        )}
        {isMerged ? null : status === "archived" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void restore()}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
            data-testid="model-archive-button"
            aria-label={`Restore ${name}`}
          >
            {busy ? "Working…" : "Restore"}
          </button>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            disabled={busy}
            onClick={() => setConfirmArchive(true)}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
            data-testid="model-archive-button"
            aria-label={`Archive ${name}`}
          >
            Archive
          </button>
        )}
        {!isMerged ? (
          <Link
            href={`/models/merge?source=${id}`}
            className="rounded-md border border-border px-3 py-2 text-sm"
          >
            Merge…
          </Link>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="w-full max-w-sm space-y-2 rounded-md border border-amber-500/40 bg-background p-4 text-sm shadow-lg backdrop:bg-black/40"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="archive-confirm-dialog"
        onCancel={(e) => {
          e.preventDefault();
          setConfirmArchive(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const dialog = dialogRef.current;
          if (!dialog) return;
          const focusable = Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
          if (focusable.length === 0) {
            e.preventDefault();
            dialog.focus();
            return;
          }
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement as HTMLElement | null;
          if (e.shiftKey) {
            if (!active || active === first || active === dialog) {
              e.preventDefault();
              last.focus();
            }
          } else if (!active || active === last || active === dialog) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <p id={titleId} className="font-medium">
          Archive this model?
        </p>
        <p id={bodyId} className="text-muted-foreground">
          “{name}” will leave the default library view. You can restore it later from the archived
          filter — archive is reversible for non-merged records.
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
      </dialog>
    </div>
  );
}
