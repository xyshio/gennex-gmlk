import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import {
  archiveScanFilePath,
  isSafePersonId,
  isSafePhotoFilename,
  mimeForFilename,
} from "@/lib/photos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ personId: string; filename: string }> };

/**
 * GET /api/archive-scans/{personId}/{filename}
 *
 * Stream an archive-scan binary from
 * `data/archive-scans/{personId}/{filename}`. Same path-traversal
 * defence as the photo-serve route + same long cache (UUIDs are
 * immutable per filename).
 */
export async function GET(_req: Request, ctx: Params) {
  const { personId, filename } = await ctx.params;
  if (!isSafePersonId(personId) || !isSafePhotoFilename(filename)) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(archiveScanFilePath(personId, filename));
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "content-type": mimeForFilename(filename),
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[archive-scan serve] failed:", e);
    return NextResponse.json({ error: "io_error" }, { status: 500 });
  }
}
