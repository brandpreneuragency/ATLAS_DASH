"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { modelWriteSchema } from "@model-monitor/schemas";
import type { z } from "zod";

const formSchema = modelWriteSchema;
type FormValues = z.infer<typeof formSchema>;

interface Developer {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  mode: "create" | "edit";
  developers: Developer[];
  initial?: Partial<FormValues> & {
    id?: string;
    aliasesText?: string;
    capabilities?: {
      vision?: boolean | null;
      reasoning?: boolean | null;
      toolUse?: boolean | null;
    };
  };
}

function triToSelect(v: boolean | null | undefined): string {
  if (v === true) return "true";
  if (v === false) return "false";
  return "unknown";
}

function selectToTri(v: string): boolean | null {
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function ModelForm({ mode, developers, initial }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [aliasesText, setAliasesText] = useState(initial?.aliasesText ?? "");
  const [vision, setVision] = useState(triToSelect(initial?.capabilities?.vision));
  const [reasoning, setReasoning] = useState(triToSelect(initial?.capabilities?.reasoning));
  const [toolUse, setToolUse] = useState(triToSelect(initial?.capabilities?.toolUse));

  const defaults = useMemo<FormValues>(
    () => ({
      canonicalId: initial?.canonicalId ?? "",
      name: initial?.name ?? "",
      developerId: initial?.developerId ?? developers[0]?.id ?? "",
      family: initial?.family ?? null,
      generation: initial?.generation ?? null,
      lifecycle: initial?.lifecycle ?? "unknown",
      lifecycleRaw: initial?.lifecycleRaw ?? null,
      releaseDate: initial?.releaseDate ?? null,
      knowledgeCutoff: initial?.knowledgeCutoff ?? null,
      modelType: initial?.modelType ?? null,
      description: initial?.description ?? null,
      codingSpecialization: initial?.codingSpecialization ?? null,
      bestUse: initial?.bestUse ?? null,
      avoidFor: initial?.avoidFor ?? null,
      contextTokens: initial?.contextTokens ?? null,
      maxOutputTokens: initial?.maxOutputTokens ?? null,
      speedRating: initial?.speedRating ?? null,
      needsRecheck: initial?.needsRecheck ?? true,
    }),
    [developers, initial],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const aliases = aliasesText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((alias) => ({ alias, aliasType: "display" as const }));

    const payload = {
      ...values,
      contextTokens:
        values.contextTokens == null || Number.isNaN(values.contextTokens)
          ? null
          : values.contextTokens,
      maxOutputTokens:
        values.maxOutputTokens == null || Number.isNaN(values.maxOutputTokens)
          ? null
          : values.maxOutputTokens,
      capabilities: {
        vision: selectToTri(vision),
        reasoning: selectToTri(reasoning),
        toolUse: selectToTri(toolUse),
      },
      aliases,
    };

    const res = await fetch(
      mode === "create" ? "/api/v1/models" : `/api/v1/models/${initial?.id}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setServerError(body?.error?.message ?? "Save failed");
      return;
    }

    const model = (await res.json()) as { id: string };
    router.push(`/models/${model.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-3xl space-y-6"
      data-testid="model-form"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name?.message}>
          <input
            {...register("name")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-name"
          />
        </Field>
        <Field label="Canonical ID" error={errors.canonicalId?.message}>
          <input
            {...register("canonicalId")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            data-testid="field-canonical-id"
          />
        </Field>
        <Field label="Developer" error={errors.developerId?.message}>
          <select
            {...register("developerId")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-developer"
          >
            {developers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lifecycle" error={errors.lifecycle?.message}>
          <select
            {...register("lifecycle")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-lifecycle"
          >
            {[
              "current",
              "ga",
              "preview",
              "beta",
              "legacy",
              "deprecated",
              "retired",
              "unavailable",
              "unknown",
            ].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Family">
          <input
            {...register("family")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-family"
          />
        </Field>
        <Field label="Generation">
          <input
            {...register("generation")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Context tokens">
          <input
            type="number"
            {...register("contextTokens", {
              setValueAs: (v: string) => (v === "" ? null : Number(v)),
            })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            data-testid="field-context-tokens"
          />
        </Field>
        <Field label="Max output tokens">
          <input
            type="number"
            {...register("maxOutputTokens", {
              setValueAs: (v: string) => (v === "" ? null : Number(v)),
            })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <TriSelect label="Vision" value={vision} onChange={setVision} testId="field-vision" />
        <TriSelect
          label="Reasoning"
          value={reasoning}
          onChange={setReasoning}
          testId="field-reasoning"
        />
        <TriSelect label="Tool use" value={toolUse} onChange={setToolUse} testId="field-tool-use" />
      </div>

      <Field label="Best use">
        <textarea
          {...register("bestUse")}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Avoid for">
        <textarea
          {...register("avoidFor")}
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Description">
        <textarea
          {...register("description")}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Aliases (one per line)">
        <textarea
          value={aliasesText}
          onChange={(e) => setAliasesText(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          data-testid="field-aliases"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register("needsRecheck")} data-testid="field-needs-recheck" />
        Needs recheck
      </label>

      {serverError ? (
        <p className="text-sm text-destructive" data-testid="form-error">
          {serverError}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="model-form-submit"
        >
          {isSubmitting ? "Saving…" : mode === "create" ? "Create model" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="block text-destructive">{error}</span> : null}
    </label>
  );
}

function TriSelect({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        data-testid={testId}
      >
        <option value="unknown">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}
