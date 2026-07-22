import { NextResponse } from "next/server";
import { ModelServiceError } from "@model-monitor/database";

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonOk<T>(data: T, init?: { status?: number; requestId?: string }) {
  const response = NextResponse.json(data, { status: init?.status ?? 200 });
  if (init?.requestId) response.headers.set("x-request-id", init.requestId);
  return response;
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

  console.error("[api]", requestId, error);
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

export function auditContext(request: Request) {
  return { requestId: getRequestId(request) };
}
