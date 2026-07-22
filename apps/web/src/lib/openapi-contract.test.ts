import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  lifecycleStatusSchema,
  modelAliasWriteSchema,
  modelUpdateSchema,
  modelWriteSchema,
} from "@model-monitor/schemas";
import { parse as parseYaml } from "yaml";

const openapiPath = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "implementation-package",
  "contracts",
  "openapi.yaml",
);

type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  minLength?: number;
  minimum?: number;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
};

function loadOpenApi(): Record<string, unknown> {
  const doc = parseYaml(readFileSync(openapiPath, "utf8")) as Record<string, unknown>;
  expect(doc.openapi).toMatch(/^3\./);
  return doc;
}

function schemas(doc: Record<string, unknown>): Record<string, JsonSchema> {
  const components = doc.components as { schemas?: Record<string, JsonSchema> } | undefined;
  expect(components?.schemas).toBeTruthy();
  return components!.schemas!;
}

function paths(doc: Record<string, unknown>): Record<string, JsonSchema> {
  return (doc.paths ?? {}) as Record<string, JsonSchema>;
}

function resolveRef(doc: Record<string, unknown>, ref: string): JsonSchema {
  expect(ref.startsWith("#/components/schemas/")).toBe(true);
  const name = ref.replace("#/components/schemas/", "");
  const s = schemas(doc)[name];
  expect(s, `missing schema ${name}`).toBeTruthy();
  return s;
}

function opResponses(pathItem: JsonSchema, method: string): Record<string, unknown> {
  const op = pathItem[method] as JsonSchema | undefined;
  expect(op, `missing op ${method}`).toBeTruthy();
  return (op!.responses ?? {}) as Record<string, unknown>;
}

function assertHasStatuses(res: Record<string, unknown>, codes: string[]) {
  for (const code of codes) {
    expect(res, `missing status ${code}`).toHaveProperty(code);
  }
}

function validateAgainst(
  schema: JsonSchema,
  value: unknown,
  doc: Record<string, unknown>,
  path = "$",
): string[] {
  const errors: string[] = [];
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf as JsonSchema[]) {
      errors.push(...validateAgainst(part, value, doc, path));
    }
  }
  if (typeof schema.$ref === "string") {
    errors.push(...validateAgainst(resolveRef(doc, schema.$ref), value, doc, path));
  }
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      errors.push(`${path}: value not in enum`);
    }
  }
  const type = schema.type;
  if (type === undefined) return errors;

  const matchesType = (t: string): boolean => {
    if (t === "null") return value === null;
    if (t === "string") return typeof value === "string";
    if (t === "integer") return typeof value === "number" && Number.isInteger(value);
    if (t === "number") return typeof value === "number";
    if (t === "boolean") return typeof value === "boolean";
    if (t === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
    if (t === "array") return Array.isArray(value);
    return false;
  };

  if (Array.isArray(type)) {
    const ok = type.some((t) => matchesType(String(t)));
    if (!ok) errors.push(`${path}: type mismatch for ${JSON.stringify(type)}`);
    if (value === null) return errors;
    if (type.includes("array") && Array.isArray(value) && schema.items) {
      value.forEach((item, i) => errors.push(...validateAgainst(schema.items!, item, doc, `${path}[${i}]`)));
    }
    if (!type.includes("object")) return errors;
  } else if (type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`${path}: expected object`);
      return errors;
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`);
      return errors;
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validateAgainst(schema.items!, item, doc, `${path}[${i}]`));
      });
    }
    return errors;
  } else if (type === "string") {
    if (typeof value !== "string") errors.push(`${path}: expected string`);
    if (schema.format === "uuid" && typeof value === "string") {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        errors.push(`${path}: expected uuid`);
      }
    }
    if (typeof schema.minLength === "number" && typeof value === "string" && value.length < schema.minLength) {
      errors.push(`${path}: minLength`);
    }
    return errors;
  } else if (type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) errors.push(`${path}: expected integer`);
    if (typeof schema.minimum === "number" && typeof value === "number" && value < schema.minimum) {
      errors.push(`${path}: minimum`);
    }
    return errors;
  } else if (type === "boolean") {
    if (typeof value !== "boolean") errors.push(`${path}: expected boolean`);
    return errors;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const props = schema.properties ?? {};
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) errors.push(`${path}: missing required ${key}`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}: unexpected ${key}`);
      }
    }
    for (const [key, child] of Object.entries(props)) {
      if (key in value) {
        errors.push(
          ...validateAgainst(child, (value as Record<string, unknown>)[key], doc, `${path}.${key}`),
        );
      }
    }
  }
  return errors;
}

describe("OpenAPI contract structural alignment", () => {
  const doc = loadOpenApi();
  const s = schemas(doc);
  const p = paths(doc);

  it("is OpenAPI 3.x with session security default", () => {
    expect(String(doc.openapi)).toMatch(/^3\./);
    const components = doc.components as { securitySchemes?: Record<string, unknown> };
    expect(components.securitySchemes?.sessionAuth).toBeTruthy();
    expect(doc.security).toEqual([{ sessionAuth: [] }]);
  });

  it("ModelPatch mirrors Zod optionality, UUID developer, lifecycle enum, alias shape", () => {
    const patch = s.ModelPatch;
    expect(patch.required).toBeUndefined();
    expect(patch.additionalProperties).toBe(false);
    const props = patch.properties ?? {};
    expect(props.developerId).toMatchObject({ type: "string", format: "uuid" });
    expect(props.lifecycle?.enum).toEqual([...lifecycleStatusSchema.options]);
    expect(props.aliases?.items?.$ref).toBe("#/components/schemas/ModelAliasWrite");

    const alias = s.ModelAliasWrite;
    expect(alias.required).toEqual(["alias"]);
    expect(alias.additionalProperties).toBe(false);
    const aliasProps = alias.properties ?? {};
    expect(aliasProps.alias).toMatchObject({ type: "string", minLength: 1 });
    expect(aliasProps.aliasType?.enum).toEqual(["display", "short", "provider", "legacy", "other"]);
    expect(aliasProps.accessProviderId?.type).toEqual(["string", "null"]);
  });

  it("ModelWrite requires the same core fields as Zod", () => {
    const write = s.ModelWrite;
    expect(write.required).toEqual(["canonicalId", "name", "developerId"]);
    const props = write.properties ?? {};
    expect(props.developerId).toMatchObject({ type: "string", format: "uuid" });
    expect(props.lifecycle?.enum).toEqual([...lifecycleStatusSchema.options]);
  });

  it("response Model uses response aliases and validates complete runtime identity", () => {
    expect(s.Model.properties?.id).toMatchObject({ type: "string", format: "uuid" });
    expect(s.Model.properties?.aliases?.items?.$ref).toBe("#/components/schemas/ModelAlias");
    const response = {
      id: "00000000-0000-4000-8000-000000000001",
      canonicalId: "vendor:model",
      name: "Model",
      developerId: "00000000-0000-4000-8000-000000000002",
      lifecycle: "ga",
      status: "active",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      aliases: [{ id: "00000000-0000-4000-8000-000000000003", alias: "m", aliasType: "display" }],
    };
    expect(validateAgainst(s.Model, response, doc)).toEqual([]);
    const contradictory = { ...response, aliases: [{ alias: "m", aliasType: "display", normalizedAlias: "m", createdAt: null }] };
    expect(validateAgainst(s.Model, contradictory, doc).some((e) => e.includes("id"))).toBe(true);
  });

  it("response ModelAlias includes id and optional normalized metadata", () => {
    const alias = s.ModelAlias;
    expect(alias.required).toEqual(expect.arrayContaining(["id", "alias", "aliasType"]));
    const props = alias.properties ?? {};
    expect(props.id).toMatchObject({ type: "string", format: "uuid" });
    expect(props.normalizedAlias).toBeTruthy();
  });

  it("documents update/restore/list/create/merge/alias/history statuses used at runtime", () => {
    assertHasStatuses(opResponses(p["/models/{modelId}"], "patch"), ["400", "401", "404", "409"]);
    assertHasStatuses(opResponses(p["/models/{modelId}"], "get"), ["400", "401", "404"]);
    assertHasStatuses(opResponses(p["/models/{modelId}"], "delete"), ["400", "401", "404", "409"]);
    assertHasStatuses(opResponses(p["/models/{modelId}/restore"], "post"), ["400", "401", "404", "409"]);
    assertHasStatuses(opResponses(p["/models"], "get"), ["400", "401"]);
    assertHasStatuses(opResponses(p["/models"], "post"), ["400", "401", "409"]);
    assertHasStatuses(opResponses(p["/models/merge"], "post"), ["400", "401", "404", "409"]);
    assertHasStatuses(opResponses(p["/models/{modelId}/aliases"], "post"), ["400", "401", "404", "409"]);
    assertHasStatuses(opResponses(p["/models/{modelId}/history"], "get"), ["400", "401", "404"]);
  });

  it("UUID path/entity identifiers declare format uuid", () => {
    const params = (p["/models/{modelId}"].parameters ?? []) as JsonSchema[];
    const modelIdParam = params.find((x) => x.name === "modelId");
    expect((modelIdParam?.schema as JsonSchema | undefined)?.format).toBe("uuid");
    const mergePost = p["/models/merge"].post as JsonSchema;
    const body = (
      (mergePost.requestBody as JsonSchema).content as {
        "application/json": { schema: JsonSchema };
      }
    )["application/json"].schema;
    const props = body.properties ?? {};
    expect(props.sourceModelId?.format).toBe("uuid");
    expect(props.targetModelId?.format).toBe("uuid");
    const resProps = props.resolutions?.properties ?? {};
    expect(resProps.lifecycle?.enum).toEqual([...lifecycleStatusSchema.options]);
    expect(resProps.contextTokens?.minimum).toBe(0);
    expect(Array.isArray(resProps.family?.type) && resProps.family.type.includes("null")).toBe(true);
  });

  it("alias endpoint references strict ModelAliasWrite component", () => {
    const post = p["/models/{modelId}/aliases"].post as JsonSchema;
    const body = (
      (post.requestBody as JsonSchema).content as {
        "application/json": { schema: JsonSchema };
      }
    )["application/json"].schema;
    expect(body.$ref).toBe("#/components/schemas/ModelAliasWrite");
  });

  it("documents merge Idempotency-Key header as required", () => {
    const merge = p["/models/merge"].post as JsonSchema;
    const params = (merge.parameters ?? []) as JsonSchema[];
    const key = params.find((x) => x.name === "Idempotency-Key");
    expect(key?.required).toBe(true);
  });

  it("validates representative good/bad payloads against OpenAPI structure and runtime Zod", () => {
    const write = s.ModelWrite;
    const good = {
      canonicalId: "x:1",
      name: "X",
      developerId: "00000000-0000-4000-8000-000000000001",
      lifecycle: "ga",
      aliases: [{ alias: "x", aliasType: "display" }],
    };
    expect(validateAgainst(write, good, doc)).toEqual([]);
    expect(modelWriteSchema.safeParse(good).success).toBe(true);

    const badDev = { ...good, developerId: "not-a-uuid" };
    expect(validateAgainst(write, badDev, doc).some((e) => e.includes("uuid"))).toBe(true);
    expect(modelUpdateSchema.safeParse({ developerId: "not-a-uuid" }).success).toBe(false);

    expect(modelUpdateSchema.safeParse({ lifecycle: "not-real" }).success).toBe(false);
    const lifecycleSchema = (s.ModelPatch.properties ?? {}).lifecycle ?? {};
    expect(validateAgainst(lifecycleSchema, "not-real", doc).length).toBeGreaterThan(0);

    expect(modelAliasWriteSchema.safeParse({ alias: "  " }).success).toBe(false);
    expect(validateAgainst(s.ModelAliasWrite, { alias: "" }, doc).length).toBeGreaterThan(0);

    const aliasResponse = {
      id: "00000000-0000-4000-8000-000000000099",
      alias: "x",
      aliasType: "provider",
      accessProviderId: null,
      normalizedAlias: "x",
    };
    expect(validateAgainst(s.ModelAlias, aliasResponse, doc)).toEqual([]);
  });
});
