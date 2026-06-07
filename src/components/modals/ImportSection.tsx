// Local-Dexie import section. Rendered inside the existing settings modal
// (not a separate top-level modal) so the user has a single place to find
// account + app preferences.
//
// The component reads local Dexie counts on mount, renders a "found N items
// in local storage" preview, and exposes an "Import" button that calls
// `importRepository.importFromDexie()`. The import is best-effort and
// idempotent: re-running the same payload is safe.
//
// Local Dexie rows are NEVER deleted by this flow. The plan is explicit:
// "Do not auto-delete local data." A small "Clear local data" button is
// provided at the end of the section so the user can wipe the local store
// after a successful import if they want to.

import { useEffect, useState, useCallback } from 'react';
import { Database, Download, Trash2 } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import {
  importRepository,
  type ImportPreview,
  type ImportReport,
  previewHasData,
} from '../../repositories/importRepository';
import { db } from '../../services/db';

export function ImportSection() {
  const showToast = useUIStore((s) => s.showToast);
  const showToastWithAction = useUIStore((s) => s.showToastWithAction);

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Read local Dexie counts on mount so the preview is fresh.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    importRepository
      .getLocalPreview()
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Dexie failures are non-fatal — the rest of the app still works.
          // eslint-disable-next-line no-console
          console.warn('[ImportSection] preview failed:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const report = await importRepository.importFromDexie();
      setLastReport(report);
      // Refetch the preview to refresh "0 items remaining" after a fresh
      // import (the local store wasn't touched, but the user may have
      // already cleared it manually in a previous tab).
      const next = await importRepository.getLocalPreview();
      setPreview(next);
      showToast(
        buildReportToastMessage(report),
        'info',
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Import failed for an unknown reason.';
      showToast(message, 'error');
    } finally {
      setImporting(false);
    }
  }, [importing, showToast]);

  const handleClearLocal = useCallback(async () => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }
    try {
      // Wipe every local table. Dexie's `clear()` empties rows but keeps
      // the schema. This is the "wipe" the plan leaves to the user.
      await Promise.all([
        db.projects.clear(),
        db.tasks.clear(),
        db.taskComments.clear(),
        db.documents.clear(),
        db.chatThreads.clear(),
        db.chatMessages.clear(),
        db.agents.clear(),
        db.providerConfigs.clear(),
        db.quickPrompts.clear(),
        db.settings.clear(),
        db.taskAIChangeBatches.clear(),
      ]);
      const next = await importRepository.getLocalPreview();
      setPreview(next);
      setLastReport(null);
      setShowClearConfirm(false);
      showToast('Local browser data cleared.', 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not clear local data.';
      showToast(message, 'error');
    }
  }, [showClearConfirm, showToast]);

  // Expose a global "Open settings → import" hook so the auto-prompt toast
  // can deep-link into this section. The toast fires once on first login
  // if Dexie has data; the action opens the settings modal which already
  // mounts this section.
  useEffect(() => {
    function handler() {
      // The settings modal is rendered as a sibling — we just need to
      // make sure it's open. The toast's onAction does that.
    }
    window.addEventListener('tabs:openImportSection', handler);
    return () => window.removeEventListener('tabs:openImportSection', handler);
  }, []);

  void showToastWithAction; // (kept for future use; not currently needed)

  if (loading) {
    return (
      <div data-testid="import-section-loading">
        <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>Local data</h3>
        <div className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>Checking local storage…</div>
      </div>
    );
  }

  const hasData = preview ? previewHasData(preview) : false;

  return (
    <div data-testid="import-section">
      <h3 className="semibold" style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>Local data</h3>

      {hasData && preview ? (
        <>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: '1px solid var(--c-border-1)',
              background: 'var(--c-background-2)',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Database size={20} style={{ color: 'var(--c-accent-center-panel)' }} />
            <div className="flex-1" style={{ fontSize: 'var(--fs-sm)' }}>
              <div className="semibold">Local data found in this browser</div>
              <div className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 4 }}>
                {buildPreviewSummary(preview)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="btn w-full"
            data-testid="import-button"
            style={{
              padding: 12,
              borderRadius: 12,
              fontSize: 'var(--fs-sm)',
              justifyContent: 'space-between',
              opacity: importing ? 0.6 : 1,
              cursor: importing ? 'wait' : 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Download size={16} />
              {importing ? 'Importing…' : 'Import local browser data'}
            </span>
            <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>→</span>
          </button>

          {lastReport ? (
            <div
              className="subtle"
              data-testid="import-report"
              style={{ fontSize: 'var(--fs-xs)', marginTop: 8, lineHeight: 1.5 }}
            >
              {buildReportSummary(lastReport)}
            </div>
          ) : null}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-border-1)' }}>
            <button
              type="button"
              onClick={handleClearLocal}
              className="btn w-full"
              data-testid="clear-local-button"
              style={{
                padding: 10,
                borderRadius: 12,
                fontSize: 'var(--fs-sm)',
                justifyContent: 'space-between',
                color: showClearConfirm ? 'var(--c-danger)' : 'var(--c-text-2)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Trash2 size={14} />
                {showClearConfirm ? 'Click again to confirm' : 'Clear local data'}
              </span>
              <span className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>↺</span>
            </button>
            <div className="subtle" style={{ fontSize: 'var(--fs-xs)', marginTop: 6 }}>
              Wipes everything in this browser. Server data is not affected.
            </div>
          </div>
        </>
      ) : (
        <div className="subtle" style={{ fontSize: 'var(--fs-xs)' }}>
          No local browser data found. Import becomes available when you have Dexie rows from a
          previous local-first build of TABS.
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPreviewSummary(p: ImportPreview): string {
  const parts: string[] = [];
  if (p.projects) parts.push(`${p.projects} project${p.projects === 1 ? '' : 's'}`);
  if (p.tasks) parts.push(`${p.tasks} task${p.tasks === 1 ? '' : 's'}`);
  if (p.comments) parts.push(`${p.comments} comment${p.comments === 1 ? '' : 's'}`);
  if (p.documents) parts.push(`${p.documents} document${p.documents === 1 ? '' : 's'}`);
  if (p.chatMessages) parts.push(`${p.chatMessages} chat message${p.chatMessages === 1 ? '' : 's'}`);
  if (p.chatThreads) parts.push(`${p.chatThreads} chat thread${p.chatThreads === 1 ? '' : 's'}`);
  if (p.agents) parts.push(`${p.agents} agent${p.agents === 1 ? '' : 's'}`);
  if (p.providerConfigs) parts.push(`${p.providerConfigs} provider config${p.providerConfigs === 1 ? '' : 's'}`);
  if (p.quickPrompts) parts.push(`${p.quickPrompts} quick prompt${p.quickPrompts === 1 ? '' : 's'}`);
  if (p.settings) parts.push(`${p.settings} setting${p.settings === 1 ? '' : 's'}`);
  if (p.taskAIChangeBatches) parts.push(`${p.taskAIChangeBatches} AI history batch${p.taskAIChangeBatches === 1 ? '' : 's'}`);
  if (p.files) parts.push(`${p.files} attachment${p.files === 1 ? '' : 's'} to upload`);
  return parts.length > 0 ? parts.join(' · ') : '0 items';
}

function buildReportSummary(r: ImportReport): string {
  const parts: string[] = [];
  if (r.projects.imported) parts.push(`${r.projects.imported} project${r.projects.imported === 1 ? '' : 's'}`);
  if (r.tasks.imported) parts.push(`${r.tasks.imported} task${r.tasks.imported === 1 ? '' : 's'}`);
  if (r.taskComments.imported) parts.push(`${r.taskComments.imported} comment${r.taskComments.imported === 1 ? '' : 's'}`);
  if (r.documents.imported) parts.push(`${r.documents.imported} document${r.documents.imported === 1 ? '' : 's'}`);
  if (r.chatMessages.imported) parts.push(`${r.chatMessages.imported} chat message${r.chatMessages.imported === 1 ? '' : 's'}`);
  if (r.chatThreads.imported) parts.push(`${r.chatThreads.imported} chat thread${r.chatThreads.imported === 1 ? '' : 's'}`);
  if (r.agents.imported) parts.push(`${r.agents.imported} agent${r.agents.imported === 1 ? '' : 's'}`);
  if (r.providerConfigs.imported) parts.push(`${r.providerConfigs.imported} provider config${r.providerConfigs.imported === 1 ? '' : 's'}`);
  if (r.quickPrompts.imported) parts.push(`${r.quickPrompts.imported} quick prompt${r.quickPrompts.imported === 1 ? '' : 's'}`);
  if (r.settings.imported) parts.push(`${r.settings.imported} setting${r.settings.imported === 1 ? '' : 's'}`);
  if (r.taskAIChangeBatches.imported) parts.push(`${r.taskAIChangeBatches.imported} AI history batch${r.taskAIChangeBatches.imported === 1 ? '' : 's'}`);
  if (r.files.uploaded) parts.push(`${r.files.uploaded} file${r.files.uploaded === 1 ? '' : 's'} uploaded`);

  const skipped = sumField(r, 'skipped');
  const failed = sumField(r, 'failed');
  const fileFailed = r.files.failed;

  const summary = parts.length > 0
    ? `Imported: ${parts.join(', ')}.`
    : 'No new items to import.';
  const extras: string[] = [];
  if (skipped) extras.push(`${skipped} skipped (already imported)`);
  if (failed) extras.push(`${failed} failed`);
  if (fileFailed) extras.push(`${fileFailed} attachment${fileFailed === 1 ? '' : 's'} failed`);
  if (extras.length > 0) return `${summary} ${extras.join(' · ')}`;
  return summary;
}

function sumField(
  r: ImportReport,
  key: 'imported' | 'skipped' | 'failed',
): number {
  return (
    r.projects[key] +
    r.tasks[key] +
    r.taskComments[key] +
    r.documents[key] +
    r.chatThreads[key] +
    r.chatMessages[key] +
    r.agents[key] +
    r.providerConfigs[key] +
    r.quickPrompts[key] +
    r.settings[key] +
    r.taskAIChangeBatches[key]
  );
}

function buildReportToastMessage(r: ImportReport): string {
  const imported = sumField(r, 'imported');
  const files = r.files.uploaded;
  const skipped = sumField(r, 'skipped');
  const failed = sumField(r, 'failed');
  if (imported === 0 && skipped === 0 && files === 0) {
    return 'No new items to import.';
  }
  const parts: string[] = [];
  if (imported) parts.push(`${imported} item${imported === 1 ? '' : 's'} imported`);
  if (files) parts.push(`${files} file${files === 1 ? '' : 's'} uploaded`);
  if (skipped) parts.push(`${skipped} skipped`);
  if (failed) parts.push(`${failed} failed`);
  return `Import complete. ${parts.join(' · ')}`;
}
