import Link from "next/link";
import { getAccessMatrix } from "@model-monitor/database";
import { db } from "@/lib/db";
import { AccessMatrixFilters } from "@/components/access-matrix/access-matrix-filters";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AccessMatrixPage({ searchParams }: Props) {
  const params = await searchParams;
  const query: Record<string, unknown> = {};
  const search = first(params.search);
  const accessProvider = first(params.accessProvider);
  const availability = first(params.availability);
  const developer = first(params.developer);
  const cliOnly = first(params.cliOnly);

  if (search) query.search = search;
  if (developer) query.developer = developer;
  if (accessProvider) query.accessProvider = accessProvider;
  if (availability) query.availability = availability;
  if (cliOnly) query.cliOnly = cliOnly;

  const rows = await getAccessMatrix(db, query);

  return (
    <div className="space-y-6" data-testid="access-matrix-page">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Access Matrix</h1>
        <p className="text-sm text-muted-foreground">
          Every model and the providers/plans that grant access · {rows.length} models
        </p>
      </div>

      <AccessMatrixFilters
        initial={{
          search: search ?? "",
          accessProvider: accessProvider ?? "",
          availability: availability ?? "",
        }}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm" data-testid="access-matrix-table">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-muted/40 px-3 py-2">
                Model
              </th>
              <th scope="col" className="px-3 py-2">
                Developer
              </th>
              <th scope="col" className="px-3 py-2">
                Access paths
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-10 text-center text-muted-foreground"
                  data-testid="access-matrix-empty"
                >
                  No models match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.modelId}
                  className="border-t border-border hover:bg-muted/20"
                  data-testid="access-row"
                >
                  <td className="sticky left-0 z-10 bg-background px-3 py-2">
                    <Link
                      href={`/models/${row.modelId}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {row.modelName}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">
                      {row.canonicalId}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {row.developerName ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1.5">
                      {row.access.map((a) => (
                        <AccessChip key={a.accessId} access={a} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessChip({ access }: { access: AccessRowAccess }) {
  const flags: string[] = [];
  if (access.cliOnly) flags.push("CLI-only");
  if (access.webOnly) flags.push("Web-only");
  if (access.apiCompatible === true) {
    flags.push("API");
  } else if (access.apiCompatible === false) {
    flags.push("No API");
  }
  if (access.apiAccessType === "separate_billing") {
    flags.push("Separate billing");
  } else if (access.apiAccessType === "none") {
    flags.push("No API credits");
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
      data-testid="access-chip"
    >
      <span className="font-medium text-foreground">{access.accessProviderName}</span>
      <span className="text-muted-foreground">·</span>
      <span>{access.planName}</span>
      <span className="text-muted-foreground">·</span>
      <span className="capitalize">{access.accessMethod.replace(/_/g, " ")}</span>
      <span className="text-muted-foreground">·</span>
      <AvailabilityBadge availability={access.availability} />
      {flags.length > 0 ? (
        <>
          <span className="text-muted-foreground">·</span>
          {flags.map((f) => (
            <span
              key={f}
              className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </>
      ) : null}
    </div>
  );
}

function AvailabilityBadge({ availability }: { availability: string }) {
  const label =
    availability === "confirmed"
      ? "Confirmed"
      : availability === "unconfirmed"
        ? "Unconfirmed"
        : availability === "unavailable"
          ? "Unavailable"
          : availability === "removed"
            ? "Removed"
            : availability || "Unknown";
  const cls =
    availability === "confirmed"
      ? "text-emerald-300"
      : availability === "unconfirmed"
        ? "text-amber-300"
        : availability === "unavailable"
          ? "text-rose-300"
          : availability === "removed"
            ? "text-muted-foreground line-through"
            : "text-muted-foreground";
  return <span className={cls}>{label}</span>;
}

type AccessRowAccess = Awaited<ReturnType<typeof getAccessMatrix>>[number]["access"][number];
