"use client";

import { useEffect, useState } from "react";

type Token = {
  id: string;
  name: string;
  tokenPrefix: string;
  revokedAt: string | null;
  expiresAt: string | null;
};

type SavedView = {
  id: string;
  name: string;
  columns: string[];
  density: "comfortable" | "compact" | "spacious";
};

type ApiResponse<T> = { data: T };

export async function readApiData<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error("API request failed");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("Invalid API response");
  }
  return (body as ApiResponse<T>).data;
}

const viewColumns = ["name", "provider", "status", "contextWindow", "updatedAt"] as const;

export function SettingsPanel() {
  const [interval, setIntervalDays] = useState("30");
  const [threshold, setThreshold] = useState("30");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [viewColumnsSelected, setViewColumnsSelected] = useState<string[]>(["name"]);
  const [density, setDensity] = useState<SavedView["density"]>("comfortable");
  const [viewsLoading, setViewsLoading] = useState(true);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [viewsMessage, setViewsMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const settingsRequest = fetch("/api/v1/settings/verification")
      .then((response) => readApiData<{ intervalDays: number; thresholdDays: number }>(response))
      .then((settings) => {
        setIntervalDays(String(settings.intervalDays));
        setThreshold(String(settings.thresholdDays));
      })
      .catch(() => setLoadError("Unable to load verification settings."));
    const tokensRequest = fetch("/api/v1/api-tokens")
      .then((response) => readApiData<Token[]>(response))
      .then(setTokens)
      .catch(() => setLoadError("Unable to load API tokens."));
    const viewsRequest = fetch("/api/v1/saved-views")
      .then((response) => readApiData<SavedView[]>(response))
      .then(setViews)
      .catch(() => setViewsError("Unable to load saved views"))
      .finally(() => setViewsLoading(false));
    void Promise.all([settingsRequest, tokensRequest, viewsRequest]);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/v1/settings/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intervalDays: Number(interval), thresholdDays: Number(threshold) }) });
    setMessage(r.ok ? "Verification settings saved" : "Unable to save settings");
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/v1/api-tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!r.ok) { setMessage("Unable to create token"); return; }
    const x = await r.json() as Token & { token: string };
    setRevealed(x.token); setName(""); setTokens((t) => [x, ...t]);
  }

  async function revoke(id: string) {
    const r = await fetch(`/api/v1/api-tokens/${id}`, { method: "DELETE" });
    if (r.ok) setTokens((t) => t.map((x) => x.id === id ? { ...x, revokedAt: new Date().toISOString() } : x));
  }

  function toggleColumn(column: string) {
    setViewColumnsSelected((selected) => selected.includes(column) ? selected.filter((x) => x !== column) : [...selected, column]);
  }

  async function createView(e: React.FormEvent) {
    e.preventDefault();
    setViewsMessage(null);
    if (!viewName.trim()) { setViewsMessage("Enter a name for the saved view."); return; }
    if (viewColumnsSelected.length === 0) { setViewsMessage("Select at least one column."); return; }
    const r = await fetch("/api/v1/saved-views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: viewName.trim(), columns: viewColumnsSelected, filters: {}, density }) });
    if (!r.ok) { setViewsMessage("Unable to create saved view."); return; }
    const response = await r.json() as ApiResponse<SavedView>;
    setViews((current) => [response.data, ...current]);
    setViewName(""); setViewsMessage("Saved view created.");
  }

  async function deleteView(id: string) {
    const r = await fetch(`/api/v1/saved-views/${id}`, { method: "DELETE" });
    if (!r.ok) { setViewsMessage("Unable to delete saved view."); return; }
    setViews((current) => current.filter((view) => view.id !== id));
    setViewsMessage("Saved view deleted.");
  }

  return <div className="space-y-6">
    {loadError && <p role="alert" className="text-sm">{loadError}</p>}
    <form onSubmit={save} className="space-y-4 rounded-lg border border-border bg-card p-4"><h2 className="font-semibold">Verification settings</h2><label className="block text-sm">Verification interval (days)<input required min="1" type="number" value={interval} onChange={(e) => setIntervalDays(e.target.value)} className="mt-1 block rounded border border-border bg-background p-2" /></label><label className="block text-sm">Recheck threshold (days)<input required min="1" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1 block rounded border border-border bg-background p-2" /></label><button className="rounded bg-primary px-3 py-2 text-primary-foreground">Save settings</button></form>
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="saved-views-heading"><h2 id="saved-views-heading" className="font-semibold">Saved table views</h2><p className="mt-1 text-sm text-muted-foreground">Save a table layout for quick access.</p>
      <form onSubmit={createView} className="my-3 space-y-3"><label className="block text-sm" htmlFor="saved-view-name">Name<input id="saved-view-name" value={viewName} onChange={(e) => setViewName(e.target.value)} className="mt-1 block rounded border border-border bg-background p-2" /></label><fieldset><legend className="text-sm">Columns</legend><div className="mt-1 flex flex-wrap gap-3">{viewColumns.map((column) => <label key={column} className="text-sm"><input type="checkbox" checked={viewColumnsSelected.includes(column)} onChange={() => toggleColumn(column)} /> <span className="ml-1">{column}</span></label>)}</div></fieldset><label className="block text-sm" htmlFor="saved-view-density">Density<select id="saved-view-density" value={density} onChange={(e) => setDensity(e.target.value as SavedView["density"])} className="ml-2 rounded border border-border bg-background p-2"><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="spacious">Spacious</option></select></label><button className="rounded bg-primary px-3 py-2 text-primary-foreground">Create saved view</button></form>
      {viewsMessage && <p role="status" className="mb-3 text-sm">{viewsMessage}</p>}{viewsLoading && <p role="status" className="text-sm">Loading saved views…</p>}{viewsError && <p role="alert" className="text-sm">{viewsError}</p>}{!viewsLoading && !viewsError && views.length === 0 && <p className="text-sm">No saved views yet.</p>}{views.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Saved table views</caption><thead><tr><th scope="col" className="py-2">Name</th><th scope="col">Density</th><th scope="col">Columns</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{views.map((view) => <tr key={view.id} className="border-t border-border"><th scope="row" className="py-2 font-medium">{view.name}</th><td>{view.density}</td><td>{view.columns.join(", ")}</td><td className="text-right"><button type="button" onClick={() => void deleteView(view.id)} className="rounded border border-border px-2 py-1">Delete</button></td></tr>)}</tbody></table></div>}
    </section>
    <section className="rounded-lg border border-border bg-card p-4"><h2 className="font-semibold">API tokens</h2>{revealed && <div role="alert" className="my-3 rounded border border-amber-500/50 p-3"><p className="text-sm font-medium">Copy this token now. It will not be shown again.</p><input aria-label="New API token" readOnly value={revealed} className="mt-2 w-full rounded border border-border bg-background p-2" onFocus={(e) => e.currentTarget.select()} /></div>}<form onSubmit={create} className="my-3 flex gap-2"><label className="sr-only" htmlFor="token-name">Token name</label><input id="token-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="rounded border border-border bg-background p-2" /><button className="rounded bg-primary px-3 py-2 text-primary-foreground">Create token</button></form><ul className="divide-y divide-border">{tokens.map((t) => <li key={t.id} className="flex items-center justify-between py-3 text-sm"><span>{t.name} <span className="text-muted-foreground">{t.tokenPrefix}…</span>{t.revokedAt && <span className="ml-2">(revoked)</span>}</span><button type="button" disabled={Boolean(t.revokedAt)} onClick={() => void revoke(t.id)} className="rounded border border-border px-2 py-1 disabled:opacity-50">Revoke</button></li>)}</ul></section>{message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
