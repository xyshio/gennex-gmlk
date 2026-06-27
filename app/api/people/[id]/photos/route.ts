import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { readTree, updateTree } from "@/lib/store";
import { uuid } from "@/lib/uuid";
import {
  MAX_PHOTO_BYTES,
  ensurePersonPhotoDir,
  extForMime,
  isSafePersonId,
  photoFilePath,
} from "@/lib/photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/people/{id}/photos
 *
 * Multipart upload. The field name is `file` (matches the
 * <input name="file"> in PhotoGallery). One file per request — keeps
 * the route simple and lets the client batch multiple uploads with
 * its own progress UI.
 *
 * On success returns the updated `photos` array so the client can
 * patch its local state without a full refetch.
 */
export async function POST(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  if (!isSafePersonId(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  // Confirm person exists before touching the filesystem — otherwise
  // a typo'd ID would leak orphan files into `data/photos/`.
  const tree = await readTree();
  if (!tree.persons.some((p) => p.id === id)) {
    return NextResponse.json({ error: "person_not_found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "bad_multipart" },
      { status: 400 },
    );
  }
  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Expected a 'file' part" },
      { status: 400 },
    );
  }

  if (entry.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (entry.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      {
        error: "too_large",
        message: `Max ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB`,
      },
      { status: 413 },
    );
  }
  const ext = extForMime(entry.type);
  if (!ext) {
    return NextResponse.json(
      {
        error: "unsupported_type",
        message: `Got ${entry.type || "unknown"}; supported: JPEG, PNG, WebP, GIF`,
      },
      { status: 415 },
    );
  }

  const filename = `${uuid()}.${ext}`;
  await ensurePersonPhotoDir(id);
  const buf = Buffer.from(await entry.arrayBuffer());
  await fs.writeFile(photoFilePath(id, filename), buf);

  let updatedPhotos: string[] = [];
  await updateTree((t) => {
    const p = t.persons.find((x) => x.id === id);
    if (p) {
      p.photos = [...p.photos, filename];
      p.updatedAt = new Date().toISOString();
      updatedPhotos = p.photos;
    }
    return t;
  });

  return NextResponse.json(
    { filename, photos: updatedPhotos },
    { status: 201 },
  );
}
