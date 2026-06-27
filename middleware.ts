import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Auth gate for the entire app.
 *
 * Allows through:
 *   - /login (the form itself)
 *   - /api/auth/* (login + logout endpoints)
 *   - Static / framework asset paths via the matcher exclusions below
 *
 * Everything else requires a valid signed session cookie. Page
 * requests get a 302 to /login (with `?next=` so we can bounce back
 * after sign-in); API requests get a 401 JSON body so the client can
 * recover gracefully.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Public routes — login UI + auth endpoints.
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  const secret =
    process.env.GENNEX_SESSION_SECRET ??
    process.env.SESSION_SECRET ??
    "";
  const username = secret ? await verifySessionToken(token, secret) : null;

  if (username) {
    return NextResponse.next();
  }

  // Unauthenticated. For API routes, return 401 so fetch callers can
  // react with redirects in client code. For page navigations, 302 to
  // /login with `?next=` preserved.
  if (pathname.startsWith("/api/")) {
    return new NextResponse(
      JSON.stringify({ error: "unauthenticated" }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    );
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match everything except Next.js internals + static asset paths.
    // (Auth-public routes are filtered inside the handler so we stay
    // explicit about what's open.)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2|woff|ttf|map)).*)",
  ],
};
