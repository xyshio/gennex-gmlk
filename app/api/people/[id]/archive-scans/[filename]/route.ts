import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { updateTree } from "@/lib/store";
import {
  archiveScanFilePath,
  isSafePersonId,
  isSafePhotoFilename,
} from "@/lib/photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; filename: string }> };

/**
 * DELETE /api/people/{id}/archive-scans/{filename}
 *
 * Removes the entry from the person's `archiveScans` array AND
 * unlinks the file on disk. ENOENT on unlink is swallowed for
 * idempotency (handy when re-running the same call after a partial
 * sync left the JSON pointing at a file that's already gone).
 */
export async function DELETE(_req: Request, ctx: Params) {
  const { id, filename } = await ctx.params;
  if (!isSafePersonId(id) || !isSafePhotoFilename(filename)) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }
  let removed = false;
  await updateTree((t) => {
    const p = t.persons.find((x) => x.id === id);
    if (!p) return t;
    const arr = p.archiveScans ?? [];
    const before = arr.length;
    p.archiveScans = arr.filter((f) => f !== filename);
    if (p.archiveScans.length < before) {
      removed = true;
      p.updatedAt = new Date().toISOString();
    }
    return t;
  });
  try {
    await fs.unlink(archiveScanFilePath(id, filename));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(
        "[archive-scan delete] unlink failed (file may be already gone):",
        err.code,
        err.message,
      );
    }
  }
  if (!removed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
