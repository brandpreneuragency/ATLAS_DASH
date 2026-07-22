import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  isDevAuthBypassEnabled,
  isEmailAllowed,
  isPublicPath,
  parseAllowedEmails,
} from "@/lib/auth-policy";

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    return response;
  }

  if (isDevAuthBypassEnabled()) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-auth-bypass", "1");
    return response;
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  const allowedEmails = parseAllowedEmails(process.env.ALLOWED_EMAILS);
  const email =
    typeof token?.email === "string"
      ? token.email
      : typeof token?.email === "object" && token?.email && "toString" in token.email
        ? String(token.email)
        : null;

  const allowed = Boolean(
    token &&
      isEmailAllowed(email, {
        allowedEmails,
        devBypass: false,
      }),
  );

  if (!token || !allowed) {
    const isApi = pathname.startsWith("/api/");
    if (isApi) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: token ? "Email is not allow-listed" : "Authentication required",
            requestId,
          },
        },
        {
          status: 401,
          headers: { "x-request-id": requestId },
        },
      );
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  // Next.js requires matcher values to be statically analyzable literals.
  // Enter middleware for everything except /_next/static/*, exact
  // /_next/image, and exact /favicon.ico. Lookalike/descendant paths remain
  // protected.
  matcher: ["/((?!_next/static/|_next/image$|favicon\\.ico$).*)"],
};
