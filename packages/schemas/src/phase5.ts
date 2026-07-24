import { z } from "zod";

export const apiTokenScopeSchema = z.literal("catalog:read");
export const createApiTokenSchema = z.object({ name: z.string().trim().min(1).max(120), expiresAt: z.string().datetime().nullable().optional() });
export const verificationSettingsSchema = z.object({ intervalDays: z.number().int().min(1).max(3650), thresholdDays: z.number().int().min(1).max(3650) }).refine((v) => v.thresholdDays <= v.intervalDays, { message: "thresholdDays must not exceed intervalDays", path: ["thresholdDays"] });
export const savedViewSchema = z.object({ name: z.string().trim().min(1).max(120), columns: z.array(z.string().trim().min(1).max(80)).max(100), filters: z.record(z.string(), z.unknown()), sort: z.string().max(120).nullable().optional(), density: z.enum(["comfortable", "compact", "spacious"]) });
export const savedViewPatchSchema = savedViewSchema.partial();
export const auditQuerySchema = z.object({ cursor: z.string().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(200).default(50), entityType: z.string().trim().min(1).max(80).optional(), action: z.string().trim().min(1).max(80).optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), search: z.string().trim().min(1).max(200).optional() }).superRefine((v, ctx) => { if (v.cursor) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cursor"], message: "cursor pagination is unsupported; use page and limit" }); if (v.from && v.to && new Date(v.from) > new Date(v.to)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "to must be on or after from" }); });
export type CreateApiToken = z.infer<typeof createApiTokenSchema>;
export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;
export type SavedView = z.infer<typeof savedViewSchema> & { id: string; createdAt: string; updatedAt: string };
export type AuditQuery = z.infer<typeof auditQuerySchema>;
