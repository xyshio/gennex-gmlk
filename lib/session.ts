/**
 * Single-user signed-cookie session — no database, no JWT lib.
 *
 * Token format: `base64url(username).base64url(hmacSha256(username, secret))`
 *
 * Solo deployment + one hardcoded credential (see `.env.local`), so a
 * stateless signed token is enough — there's no "list active sessions"
 * surface to back. Rotating `GENNEX_SESSION_SECRET` invalidates every
 * existing cookie.
 *
 * Web Crypto is used (not Node's `node:crypto`) so the same code runs
 * unchanged in Next.js edge middleware AND in node-runtime API routes.
 */

export const SESSION_COOKIE = "gennex_session";

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // btoa wants a binary string; build it byte-by-byte.
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlFromString(str: string): string {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function bytesFromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return b64urlFromBytes(sig);
}

/** Encode `{ username }` as `<b64url(username)>.<b64url(hmac)>`. */
export async function createSessionToken(
  username: string,
  secret: string,
): Promise<string> {
  const payload = b64urlFromString(username);
  const sig = await sign(payload, secret);
  return `${payload}.${sig}`;
}

/**
 * Parse + verify a token. Returns the username on success, null
 * otherwise. Uses a timing-safe comparison so an attacker can't pluck
 * the signature one byte at a time.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  let username: string;
  try {
    username = new TextDecoder().decode(bytesFromB64url(payload));
  } catch {
    return null;
  }
  const expected = await sign(payload, secret);
  // Constant-time string compare.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? username : null;
}
