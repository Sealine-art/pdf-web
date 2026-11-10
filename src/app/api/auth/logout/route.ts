import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-guards";
import { SESSION_COOKIE } from "@/lib/session-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "This sign-out request was rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
