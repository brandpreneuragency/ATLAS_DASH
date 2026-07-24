import { NextResponse } from "next/server";
import { ensureUserByEmail, ModelServiceError } from "@model-monitor/database";
import { idempotencyKeySchema, pathUuidSchema } from "@model-monitor/schemas";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isDevAuthBypassEnabled,
  isEmailAllowed,
  parseAllowedEmails,
} from "@/lib/auth-policy";
import { logger } from "@/lib/logger";

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonOk<T>(data: T, init?: { status?: number; requestId?: string }) {
  const response = NextResponse.json(data, { status: init?.status ?? 200 });
  if (init?.requestId) response.headers.set("x-request-id", init.requestId);
  return response;
}

/** Safe categorical error fields only — never raw Error.message (may contain DSN/token). */
function safeErrorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const maybeCode = (error as Error & { code?: unknown }).code;
    return {
      name: error.name,
      ...(typeof maybeCode === "string" ? { code: maybeCode } : {}),
    };
  }
  return { name: "non_error_throw" };
}

export function jsonError(
  error: unknown,
  requestId: string,
  fallbackMessage = "Unexpected error",
) {
  if (error instanceof ModelServiceError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          fieldErrors: error.fieldErrors,
        },
      },
      { status: error.status, headers: { "x-request-id": requestId } },
    );
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const field = issue.path.join(".") || "body";
      (fieldErrors[field] ??= []).push(issue.message);
    }
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          requestId,
          fieldErrors,
        },
      },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  // Never log raw Error.message or database messages — only safe categorical fields.
  logger.error("api_error", {
    requestId,
    err: safeErrorFields(error),
  });
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: fallbackMessage,
        requestId,
      },
    },
    { status: 500, headers: { "x-request-id": requestId } },
  );
}

export function auditContext(request: Request, actorUserId?: string | null) {
  return { requestId: getRequestId(request), actorUserId: actorUserId ?? null };
}

export function parsePathUuid(value: string, field = "id"): string {
  const parsed = pathUuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ModelServiceError("VALIDATION_ERROR", `Invalid ${field}`, 400, {
      [field]: ["Must be a valid UUID"],
    });
  }
  return parsed.data;
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ModelServiceError("VALIDATION_ERROR", "Malformed JSON body", 400);
  }
}

export function parseIdempotencyKey(request: Request): string {
  const raw = request.headers.get("idempotency-key") ?? request.headers.get("Idempotency-Key");
  const parsed = idempotencyKeySchema.safeParse(raw ?? "");
  if (!parsed.success) {
    throw new ModelServiceError(
      "VALIDATION_ERROR",
      "Idempotency-Key header is required and must be 1–128 non-blank characters",
      400,
      { "Idempotency-Key": ["Required non-blank string (max 128)"] },
    );
  }
  return parsed.data;
}

/**
 * Require an authenticated session for JSON API handlers.
 * Dev/test bypass returns a non-persisted actor (null user id) so audit FK stays valid.
 */
export async function requireApiSession(_requestId: string): Promise<{
  userId: string | null;
  email: string | null;
}> {
  if (isDevAuthBypassEnabled()) {
    return { userId: null, email: "dev-bypass@local" };
  }
  const session = await auth();
  if (!session?.user) {
    throw new ModelServiceError("UNAUTHORIZED", "Authentication required", 401);
  }
  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  if (
    !isEmailAllowed(session.user.email, {
      allowedEmails,
      devBypass: false,
    })
  ) {
    throw new ModelServiceError("UNAUTHORIZED", "Email is not allow-listed", 401);
  }
  const email = session.user.email?.trim().toLowerCase();
  if (!email) {
    throw new ModelServiceError("UNAUTHORIZED", "Authenticated email required", 401);
  }
  const user = await ensureUserByEmail(db, email);
  return { userId: user.id, email: user.email };
}

export function unauthorizedJson(requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
        requestId,
      },
    },
    { status: 401, headers: { "x-request-id": requestId } },
  );
}
