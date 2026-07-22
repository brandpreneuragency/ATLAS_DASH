import { listModels } from "@model-monitor/database";
import { db } from "@/lib/db";
import { MergeForm } from "@/components/models/merge-form";

interface Props {
  searchParams: Promise<{ source?: string; target?: string }>;
}

export default async function MergeModelsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const { data } = await listModels(db, { limit: 200, sort: "name", archived: "false" });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Merge models</h1>
        <p className="text-sm text-muted-foreground">
          Transfer aliases, access, benchmarks, scores, sources, and provenance from the source into
          the target. The source is archived. The operation is transactional.
        </p>
      </div>
      <MergeForm
        models={data.map((m) => ({ id: m.id, name: m.name, canonicalId: m.canonicalId }))}
        initialSourceId={sp.source}
        initialTargetId={sp.target}
      />
    </div>
  );
}
