import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — clears the session cookie. No body needed.
 * GET is wired to the same handler so a plain `<a href>` logout link
 * works as a fallback if JS is disabled.
 */
function clearCookie(): Response {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST() {
  return clearCookie();
}

export async function GET() {
  return clearCookie();
}
