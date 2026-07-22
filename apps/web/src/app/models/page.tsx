import Link from "next/link";
import { listModels } from "@model-monitor/database";
import { formatCapabilityDisplay, formatScoreDisplay } from "@model-monitor/schemas";
import { db } from "@/lib/db";
import { ModelsFilters } from "@/components/models/models-filters";
import { ModelRowActions } from "@/components/models/model-row-actions";

interface ModelsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ModelsPage({ searchParams }: ModelsPageProps) {
  const params = await searchParams;
  const query = {
    search: first(params.search),
    developer: first(params.developer),
    family: first(params.family),
    lifecycle: first(params.lifecycle),
    accessProvider: first(params.accessProvider),
    archived: first(params.archived),
    accessible: first(params.accessible),
    sort: first(params.sort) ?? "name",
    page: first(params.page) ?? "1",
    limit: first(params.limit) ?? "25",
  };

  const result = await listModels(db, query);
  const page = result.page.page ?? 1;
  const totalPages = Math.max(1, Math.ceil((result.page.total ?? 0) / (result.page.pageSize ?? 25)));

  return (
    <div className="space-y-6" data-testid="models-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Models</h1>
          <p className="text-sm text-muted-foreground">
            Canonical model library · {result.page.total ?? result.data.length} matching
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/models/merge"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            data-testid="models-merge-link"
          >
            Merge models
          </Link>
          <Link
            href="/models/new"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            data-testid="models-create-link"
          >
            Create model
          </Link>
        </div>
      </div>

      <ModelsFilters
        initial={{
          search: query.search ?? "",
          developer: query.developer ?? "",
          family: query.family ?? "",
          lifecycle: query.lifecycle ?? "",
          accessProvider: query.accessProvider ?? "",
          archived: query.archived === "true" ? "true" : "false",
          accessible: query.accessible ?? "",
          sort: query.sort ?? "name",
        }}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm" data-testid="models-table">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-muted/40 px-3 py-2">
                Model
              </th>
              <th scope="col" className="px-3 py-2">
                Developer
              </th>
              <th scope="col" className="px-3 py-2">
                Family
              </th>
              <th scope="col" className="px-3 py-2">
                Lifecycle
              </th>
              <th scope="col" className="px-3 py-2">
                Capability
              </th>
              <th scope="col" className="px-3 py-2">
                Balanced
              </th>
              <th scope="col" className="px-3 py-2">
                Value
              </th>
              <th scope="col" className="px-3 py-2">
                Context
              </th>
              <th scope="col" className="px-3 py-2">
                Vision
              </th>
              <th scope="col" className="px-3 py-2">
                Reasoning
              </th>
              <th scope="col" className="px-3 py-2">
                Available through
              </th>
              <th scope="col" className="px-3 py-2">
                Recheck
              </th>
              <th scope="col" className="px-3 py-2">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {result.data.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-muted-foreground" data-testid="models-empty">
                  No models match the current filters.
                </td>
              </tr>
            ) : (
              result.data.map((model) => {
                const vision = formatCapabilityDisplay(model.capabilities?.vision ?? null);
                const reasoning = formatCapabilityDisplay(model.capabilities?.reasoning ?? null);
                return (
                  <tr key={model.id} className="border-t border-border hover:bg-muted/20" data-testid="model-row">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2">
                      <Link href={`/models/${model.id}`} className="font-medium text-foreground hover:underline">
                        {model.name}
                      </Link>
                      <div className="font-mono text-xs text-muted-foreground">{model.canonicalId}</div>
                      {model.status === "archived" ? (
                        <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          archived
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{model.developerName}</td>
                    <td className="px-3 py-2">{model.family ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded border border-border px-1.5 py-0.5 text-xs">{model.lifecycle}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums" data-testid="score-capability">
                      {model.scores.capability?.display ?? formatScoreDisplay(null)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {model.scores.balanced?.display ?? formatScoreDisplay(null)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {model.scores.value?.display ?? formatScoreDisplay(null)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {model.contextTokens == null ? "—" : model.contextTokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2" data-testid="cap-vision">
                      <CapabilityBadge state={vision} />
                    </td>
                    <td className="px-3 py-2" data-testid="cap-reasoning">
                      <CapabilityBadge state={reasoning} />
                    </td>
                    <td className="px-3 py-2">
                      {model.accessProviders.length ? model.accessProviders.join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">{model.needsRecheck ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <ModelRowActions id={model.id} status={model.status} name={model.name} mergedIntoModelId={model.mergedIntoModelId} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={buildPageHref(query, page - 1)}
              className="rounded border border-border px-3 py-1.5 hover:bg-accent"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={buildPageHref(query, page + 1)}
              className="rounded border border-border px-3 py-1.5 hover:bg-accent"
              data-testid="models-next-page"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CapabilityBadge({ state }: { state: "yes" | "no" | "unknown" }) {
  const label = state === "yes" ? "Yes" : state === "no" ? "No" : "Unknown";
  const cls =
    state === "yes"
      ? "border-emerald-500/40 text-emerald-300"
      : state === "no"
        ? "border-rose-500/40 text-rose-300"
        : "border-border text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${cls}`}>
      <span aria-hidden>{state === "yes" ? "●" : state === "no" ? "○" : "?"}</span>
      {label}
    </span>
  );
}

function buildPageHref(
  query: Record<string, string | undefined>,
  page: number,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (!v || k === "page") continue;
    sp.set(k, v);
  }
  sp.set("page", String(page));
  return `/models?${sp.toString()}`;
}
