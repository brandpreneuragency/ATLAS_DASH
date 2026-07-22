import Link from "next/link";
import { notFound } from "next/navigation";
import { getModelById } from "@model-monitor/database";
import { formatCapabilityDisplay, formatScoreDisplay } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { ModelDetailActions } from "@/components/models/model-detail-actions";

interface Props {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const tabs = [
  "overview",
  "capabilities",
  "scores",
  "benchmarks",
  "access",
  "sources",
  "history",
] as const;

type Tab = (typeof tabs)[number];

export default async function ModelDetailPage({ params, searchParams }: Props) {
  const { modelId } = await params;
  const sp = await searchParams;
  const tab = (tabs.includes(sp.tab as Tab) ? sp.tab : "overview") as Tab;

  let model;
  try {
    model = await getModelById(db, modelId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6" data-testid="model-detail">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <Link href="/models" className="hover:underline">
              Models
            </Link>{" "}
            / {model.name}
          </div>
          <h1 className="text-2xl font-bold" data-testid="model-detail-name">
            {model.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs" data-testid="model-detail-canonical-id">
              {model.canonicalId}
            </code>
            <span>{model.developerName}</span>
            <span className="rounded border border-border px-1.5 py-0.5 text-xs uppercase">
              {model.lifecycle}
            </span>
            <span className="rounded border border-border px-1.5 py-0.5 text-xs uppercase">
              {model.status}
            </span>
            {model.verificationStatus ? (
              <span className="text-xs">Verified: {model.verificationStatus}</span>
            ) : null}
          </div>
        </div>
        <ModelDetailActions id={model.id} status={model.status} />
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-2" aria-label="Model sections">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/models/${model.id}?tab=${t}`}
            className={`rounded-md px-3 py-1.5 text-sm capitalize ${
              tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
            data-testid={`tab-${t}`}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? <OverviewTab model={model} /> : null}
      {tab === "capabilities" ? <CapabilitiesTab model={model} /> : null}
      {tab === "scores" ? <ScoresTab model={model} /> : null}
      {tab === "benchmarks" ? <BenchmarksTab model={model} /> : null}
      {tab === "access" ? <AccessTab model={model} /> : null}
      {tab === "sources" ? <SourcesTab model={model} /> : null}
      {tab === "history" ? <HistoryTab model={model} /> : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function OverviewTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card title="Context">{model.contextTokens == null ? "—" : model.contextTokens.toLocaleString()}</Card>
        <Card title="Max output">{model.maxOutputTokens == null ? "—" : model.maxOutputTokens.toLocaleString()}</Card>
        <Card title="Speed">{model.speedRating ?? "—"}</Card>
        <Card title="Needs recheck">{model.needsRecheck ? "Yes" : "No"}</Card>
        <Card title="Vision">
          {formatCapabilityDisplay(model.capabilities?.vision ?? null)}
        </Card>
        <Card title="Reasoning">
          {formatCapabilityDisplay(model.capabilities?.reasoning ?? null)}
        </Card>
        <Card title="Tools">
          {formatCapabilityDisplay(model.capabilities?.toolUse ?? null)}
        </Card>
        <Card title="Family">{model.family ?? "—"}</Card>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Best use">{model.bestUse ?? "—"}</Card>
        <Card title="Avoid for">{model.avoidFor ?? "—"}</Card>
      </div>
      <Card title="Description">{model.description ?? "—"}</Card>
      <Card title="Aliases">
        {model.aliases.length ? (
          <ul className="list-disc pl-5">
            {model.aliases.map((a) => (
              <li key={a.id}>
                {a.alias} <span className="text-muted-foreground">({a.aliasType})</span>
              </li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </Card>
    </div>
  );
}

function CapabilitiesTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  const caps = model.capabilities;
  const entries: Array<[string, boolean | null | undefined]> = [
    ["Vision", caps?.vision],
    ["Reasoning", caps?.reasoning],
    ["Tool use", caps?.toolUse],
    ["Parallel agents", caps?.parallelAgents],
    ["Computer use", caps?.computerUse],
    ["Audio input", caps?.audioInput],
    ["Video input", caps?.videoInput],
    ["Image input", caps?.imageInput],
    ["Structured output", caps?.structuredOutput],
    ["Function calling", caps?.functionCalling],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="capabilities-tab">
      {entries.map(([label, value]) => {
        const state = formatCapabilityDisplay(value ?? null);
        return (
          <div key={label} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <span>{label}</span>
            <span
              className="rounded border border-border px-2 py-0.5 text-xs uppercase"
              data-testid={`capability-${label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {state}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoresTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  return (
    <div className="space-y-3" data-testid="scores-tab">
      {model.scoreRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground">No scores recorded.</p>
      ) : (
        model.scoreRecords.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium capitalize">{s.scoreType}</div>
              <div className="text-2xl tabular-nums" data-testid={`score-value-${s.scoreType}`}>
                {s.scoreDisplay}
              </div>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
              <div>
                Methodology: {s.methodologyName}{" "}
                <span data-testid="methodology-version">v{s.methodologyVersion}</span>
              </div>
              <div>
                Rank: {s.rankValue == null ? "—" : `${s.rankValue}${s.eligibleCount ? ` / ${s.eligibleCount}` : ""}`}
              </div>
              <div>
                {s.isManualOverride ? `Override: ${s.overrideReason ?? "yes"}` : "Calculated"}
              </div>
            </div>
            {s.scoreValue === null ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Blank score is unknown — not treated as zero ({formatScoreDisplay(null)}).
              </p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

function BenchmarksTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  const groups = new Map<string, typeof model.benchmarks>();
  for (const b of model.benchmarks) {
    const key = b.comparableGroup ?? "ungrouped";
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  return (
    <div className="space-y-6" data-testid="benchmarks-tab">
      {[...groups.entries()].map(([group, rows]) => (
        <section key={group}>
          <h2 className="mb-2 text-sm font-semibold">
            Comparable group: <span data-testid="comparable-group">{group}</span>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Benchmark</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Setting</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-3 py-2">{b.benchmarkName}</td>
                    <td className="px-3 py-2">{b.category}</td>
                    <td className="px-3 py-2 tabular-nums">{b.scoreDisplay}</td>
                    <td className="px-3 py-2">{b.setting ?? "—"}</td>
                    <td className="px-3 py-2">
                      {b.sourceUrl ? (
                        <a href={b.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                          source
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{b.verifiedAt ? b.verifiedAt.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {model.benchmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No benchmark evidence.</p>
      ) : null}
    </div>
  );
}

function AccessTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border" data-testid="access-tab">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Plan</th>
            <th className="px-3 py-2">Method</th>
            <th className="px-3 py-2">Availability</th>
            <th className="px-3 py-2">Flags</th>
          </tr>
        </thead>
        <tbody>
          {model.access.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-3 py-2">{a.providerName}</td>
              <td className="px-3 py-2">{a.planName}</td>
              <td className="px-3 py-2">{a.accessMethod}</td>
              <td className="px-3 py-2">{a.availability}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {[
                  a.cliOnly ? "CLI-only" : null,
                  a.webOnly ? "Web-only" : null,
                  a.apiCompatible === true ? "API" : a.apiCompatible === false ? "No API" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {model.access.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No access paths.</p>
      ) : null}
    </div>
  );
}

function SourcesTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  return (
    <div className="space-y-3" data-testid="sources-tab">
      {model.sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sources linked.</p>
      ) : (
        model.sources.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="font-medium">{s.title ?? s.url ?? s.sourceType}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.sourceType}
              {s.publisher ? ` · ${s.publisher}` : ""}
              {s.verifiedAt ? ` · verified ${s.verifiedAt.slice(0, 10)}` : ""}
            </div>
            {s.url ? (
              <a href={s.url} className="mt-2 inline-block text-xs underline" target="_blank" rel="noreferrer">
                {s.url}
              </a>
            ) : null}
            {s.notes ? <p className="mt-2 text-muted-foreground">{s.notes}</p> : null}
          </div>
        ))
      )}
    </div>
  );
}

function HistoryTab({ model }: { model: Awaited<ReturnType<typeof getModelById>> }) {
  return (
    <div className="space-y-2" data-testid="history-tab">
      {model.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit events yet.</p>
      ) : (
        model.history.map((h) => (
          <div key={h.id} className="rounded-lg border border-border px-4 py-3 text-sm" data-testid="audit-event">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium uppercase tracking-wide">{h.action}</span>
              <time className="text-xs text-muted-foreground">{h.createdAt}</time>
            </div>
            {h.requestId ? (
              <div className="mt-1 font-mono text-xs text-muted-foreground">{h.requestId}</div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
