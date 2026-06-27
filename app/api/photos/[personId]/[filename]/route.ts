import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import {
  isSafePersonId,
  isSafePhotoFilename,
  mimeForFilename,
  photoFilePath,
} from "@/lib/photos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ personId: string; filename: string }> };

/**
 * GET /api/photos/{personId}/{filename}
 *
 * Reads a photo binary from `data/photos/{personId}/{filename}` and
 * streams it back with the right Content-Type. We DON'T serve photos
 * from /public because the whole `data/` tree (JSON + photos) lives
 * outside the app bundle and gets backed up as one folder.
 *
 * Defense: both path segments must pass a strict whitelist regex
 * before anything touches the filesystem — blocks `../` traversal,
 * encoded slashes, weird extensions.
 */
export async function GET(_req: Request, ctx: Params) {
  const { personId, filename } = await ctx.params;
  if (!isSafePersonId(personId) || !isSafePhotoFilename(filename)) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(photoFilePath(personId, filename));
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": mimeForFilename(filename),
        // Photos are immutable per filename (UUID), so they can be
        // cached aggressively. A delete uploads a new UUID — old URL
        // 404s by design.
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[photo serve] failed:", e);
    return NextResponse.json({ error: "io_error" }, { status: 500 });
  }
}
