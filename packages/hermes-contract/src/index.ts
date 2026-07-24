import { z } from "zod";

const nullableBool = z.boolean().nullable();
export const hermesAccessSchema = z.object({
  subscriptionId: z.string().nullable().optional(), provider: z.string().min(1), plan: z.string().min(1), providerModelId: z.string().nullable().optional(),
  available: z.boolean(), availability: z.enum(["confirmed", "unconfirmed", "unavailable", "removed"]).optional(), accessMethod: z.string(),
  apiCompatible: nullableBool, cliOnly: z.boolean(), webOnly: z.boolean(), limitations: z.string().nullable().optional(),
  usage: z.object({ source: z.enum(["mock","manual","estimated","provider_reported"]), isMock: z.boolean(), usedPercent: z.number().min(0).max(100).nullable().optional(), capturedAt: z.string().datetime() }).nullable().optional(),
}).strict();
export const hermesModelSchema = z.object({
  canonicalId: z.string().min(1), name: z.string().min(1), developer: z.string().min(1), family: z.string().nullable().optional(), lifecycle: z.string(),
  capabilities: z.object({ vision: nullableBool, reasoning: nullableBool, tools: nullableBool, parallelAgents: nullableBool, computerUse: nullableBool.optional() }).strict(),
  technical: z.object({ contextTokens: z.number().int().min(0).nullable().optional(), maxOutputTokens: z.number().int().min(0).nullable().optional(), speedRating: z.string().nullable().optional(), verifiedTps: z.number().min(0).nullable().optional() }).strict(),
  scores: z.record(z.object({ value: z.number().nullable(), rank: z.number().int().min(1).nullable().optional(), methodologyVersion: z.string(), confidence: z.number().nullable().optional() }).strict().nullable()),
  access: z.array(hermesAccessSchema), verification: z.object({ verifiedAt: z.string().datetime().nullable(), needsRecheck: z.boolean() }).strict(),
}).strict();
export const hermesCatalogSchema = z.object({ schemaVersion: z.literal("1.0"), generatedAt: z.string().datetime(), catalogRevision: z.number().int().min(1), models: z.array(hermesModelSchema) }).strict();
export type HermesCatalog = z.infer<typeof hermesCatalogSchema>;
export type HermesModelInput = { model: { canonicalId:string; name:string; developer:string; family:string|null; lifecycle:string; contextTokens:number|null; maxOutputTokens:number|null; speedRating:string|null; verifiedTps:number|null; verifiedAt:Date|string|null; needsRecheck:boolean; vision:boolean|null; reasoning:boolean|null; toolUse:boolean|null; parallelAgents:boolean|null; computerUse:boolean|null }; scores: Record<string,{value:number|null; rank:number|null; methodologyVersion:string; confidence:number|null}>; access: z.infer<typeof hermesAccessSchema>[] };
export function serializeHermesCatalog(input: { generatedAt: string; catalogRevision: number; models: HermesModelInput[] }): HermesCatalog {
  const models = [...input.models].sort((a,b)=>a.model.canonicalId.localeCompare(b.model.canonicalId)).map(({model,scores,access}) => ({ canonicalId:model.canonicalId,name:model.name,developer:model.developer,family:model.family,lifecycle:model.lifecycle,capabilities:{vision:model.vision,reasoning:model.reasoning,tools:model.toolUse,parallelAgents:model.parallelAgents,computerUse:model.computerUse},technical:{contextTokens:model.contextTokens,maxOutputTokens:model.maxOutputTokens,speedRating:model.speedRating,verifiedTps:model.verifiedTps},scores,access:[...access].sort((a,b)=>`${a.provider}\0${a.plan}\0${a.subscriptionId??''}`.localeCompare(`${b.provider}\0${b.plan}\0${b.subscriptionId??''}`)),verification:{verifiedAt:model.verifiedAt instanceof Date?model.verifiedAt.toISOString():model.verifiedAt,needsRecheck:model.needsRecheck}}));
  return hermesCatalogSchema.parse({schemaVersion:"1.0",generatedAt:input.generatedAt,catalogRevision:input.catalogRevision,models});
}
