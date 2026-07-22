import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getModelById, listDevelopers } from "@model-monitor/database";
import { db } from "@/lib/db";
import { ModelForm } from "@/components/models/model-form";

interface Props {
  params: Promise<{ modelId: string }>;
}

export default async function EditModelPage({ params }: Props) {
  const { modelId } = await params;
  const developers = await listDevelopers(db);
  let model;
  try {
    model = await getModelById(db, modelId);
  } catch {
    notFound();
  }

  if (model.mergedIntoModelId) {
    redirect(`/models/${model.mergedIntoModelId}`);
  }

  if (model.status === "archived" && model.mergedIntoModelId) {
    return (
      <div className="space-y-4" data-testid="merged-edit-blocked">
        <h1 className="text-2xl font-bold">Merged model</h1>
        <p className="text-sm text-muted-foreground" role="status">
          This model was merged and is immutable. Open the surviving target to edit.
        </p>
        <Link href={`/models/${model.mergedIntoModelId}`} className="underline">
          Go to surviving model
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit model</h1>
        <p className="text-sm text-muted-foreground">{model.name}</p>
      </div>
      <ModelForm
        mode="edit"
        developers={developers}
        initial={{
          id: model.id,
          canonicalId: model.canonicalId,
          name: model.name,
          developerId: model.developerId,
          family: model.family,
          generation: model.generation,
          lifecycle: model.lifecycle,
          lifecycleRaw: model.lifecycleRaw,
          releaseDate: model.releaseDate,
          knowledgeCutoff: model.knowledgeCutoff,
          modelType: model.modelType,
          description: model.description,
          codingSpecialization: model.codingSpecialization,
          bestUse: model.bestUse,
          avoidFor: model.avoidFor,
          contextTokens: model.contextTokens,
          maxOutputTokens: model.maxOutputTokens,
          speedRating: model.speedRating,
          needsRecheck: model.needsRecheck,
          aliasesText: model.aliases.map((a) => a.alias).join("\n"),
          aliases: model.aliases.map((a) => ({
            id: a.id,
            alias: a.alias,
            aliasType: a.aliasType as
              | "display"
              | "short"
              | "provider"
              | "legacy"
              | "other",
            accessProviderId: a.accessProviderId ?? null,
          })),
          capabilities: {
            vision: model.capabilities?.vision ?? null,
            reasoning: model.capabilities?.reasoning ?? null,
            toolUse: model.capabilities?.toolUse ?? null,
          },
        }}
      />
    </div>
  );
}
