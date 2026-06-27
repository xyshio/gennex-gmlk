import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { updateTree } from "@/lib/store";
import {
  isSafePersonId,
  isSafePhotoFilename,
  photoFilePath,
} from "@/lib/photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; filename: string }> };

/**
 * DELETE /api/people/{id}/photos/{filename}
 *
 * Removes the entry from the person's `photos` array AND unlinks the
 * file on disk. ENOENT on unlink is swallowed — if the disk file
 * already vanished (manual cleanup, partial sync) we still want the
 * JSON to converge.
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
    const before = p.photos.length;
    p.photos = p.photos.filter((f) => f !== filename);
    if (p.photos.length < before) {
      removed = true;
      p.updatedAt = new Date().toISOString();
    }
    return t;
  });
  try {
    await fs.unlink(photoFilePath(id, filename));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(
        "[photo delete] unlink failed (file may be already gone):",
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

/**
 * PATCH /api/people/{id}/photos/{filename}
 *
 * Body: `{ primary: true }` — moves the filename to position 0 in the
 * person's photos array. The Gallery treats index 0 as the avatar /
 * cover image, so this is how the user picks one without a separate
 * field on the Person shape.
 */
export async function PATCH(req: Request, ctx: Params) {
  const { id, filename } = await ctx.params;
  if (!isSafePersonId(id) || !isSafePhotoFilename(filename)) {
    return NextResponse.json({ error: "bad_path" }, { status: 400 });
  }
  let body: { primary?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!body.primary) {
    return NextResponse.json(
      { error: "noop", message: "Only { primary: true } is supported" },
      { status: 400 },
    );
  }
  let updatedPhotos: string[] | null = null;
  await updateTree((t) => {
    const p = t.persons.find((x) => x.id === id);
    if (!p) return t;
    const idx = p.photos.indexOf(filename);
    if (idx === -1) return t;
    if (idx === 0) {
      updatedPhotos = p.photos;
      return t;
    }
    p.photos = [filename, ...p.photos.filter((f) => f !== filename)];
    p.updatedAt = new Date().toISOString();
    updatedPhotos = p.photos;
    return t;
  });
  if (!updatedPhotos) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ photos: updatedPhotos });
}
