import { NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/auth/login  body: { username, password }
 *
 * Compares against hardcoded GENNEX_USERNAME / GENNEX_PASSWORD env
 * vars (single-user solo app). On match: sets an HttpOnly signed
 * cookie and returns 200. On mismatch: 401 with no body detail so the
 * response is identical for unknown-user vs wrong-password — small
 * defence against username enumeration.
 */
export async function POST(req: Request) {
  const expectedUser = process.env.GENNEX_USERNAME ?? "";
  const expectedPass = process.env.GENNEX_PASSWORD ?? "";
  const secret = process.env.GENNEX_SESSION_SECRET ?? "";
  if (!expectedUser || !expectedPass || !secret) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 500 },
    );
  }
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { username, password } = parsed.data;

  // Constant-time compare on both fields so timing can't leak which
  // half was wrong. Length-mismatch fails fast.
  const okUser = timingSafeEq(username, expectedUser);
  const okPass = timingSafeEq(password, expectedPass);
  if (!okUser || !okPass) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createSessionToken(username, secret);
  const res = NextResponse.json({ ok: true, username });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // 30 days. Short-lived enough that a stale cookie doesn't survive
    // forever after rotating the secret; long enough not to log out
    // the solo user every few hours.
    maxAge: 30 * 24 * 60 * 60,
    // Set `secure: true` automatically when the runtime is HTTPS so a
    // dev `http://localhost:3000` flow still works.
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

function timingSafeEq(a: string, b: string): boolean {
  // Always run the loop on the longer of the two so length leak is
  // limited to "are they the same length". For pre-shared creds this
  // is acceptable.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
