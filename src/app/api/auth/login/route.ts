import { NextResponse } from "next/server";
import { consumeRateLimit, isSameOriginRequest } from "@/lib/request-guards";
import { createSessionToken, getAccessCredentials, secureTextEqual, SESSION_COOKIE, SESSION_DURATION_SECONDS } from "@/lib/session-auth";

const LOGIN_LIMIT = 12;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This sign-in request was rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const credentials = getAccessCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "Set APP_BASIC_AUTH_USER and APP_BASIC_AUTH_PASSWORD in the server environment first." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const clientKey = forwardedFor || request.headers.get("x-real-ip") || "unknown-client";
  const rateLimit = consumeRateLimit(`sign-in:${clientKey}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length > 256 || password.length > 1024) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const usernameMatches = secureTextEqual(username, credentials.username);
  const passwordMatches = secureTextEqual(password, credentials.password);
  if (!usernameMatches || !passwordMatches) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, createSessionToken(credentials.username, credentials.password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
