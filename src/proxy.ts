import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAccessCredentials, isValidSessionToken, SESSION_COOKIE } from "@/lib/session-auth";

const PUBLIC_AUTH_PATHS = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);

function redirectToLogin(request: NextRequest, setupRequired = false) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  if (setupRequired) loginUrl.searchParams.set("setup", "1");
  else loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function accessUnavailable() {
  return NextResponse.json(
    { error: "Application access is not configured. Add APP_BASIC_AUTH_USER and APP_BASIC_AUTH_PASSWORD in the server environment." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_AUTH_PATHS.has(pathname)) return NextResponse.next();

  const credentials = getAccessCredentials();
  if (!credentials) {
    if (process.env.NODE_ENV !== "production") {
      if (pathname === "/login") return NextResponse.redirect(new URL("/", request.url));
      return NextResponse.next();
    }
    if (pathname === "/login") return NextResponse.next();
    if (pathname.startsWith("/api/")) return accessUnavailable();
    return redirectToLogin(request, true);
  }

  if (pathname === "/login") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (isValidSessionToken(token, credentials.username, credentials.password)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!isValidSessionToken(token, credentials.username, credentials.password)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return redirectToLogin(request);
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|pdf.worker.min.mjs).*)"],
};
