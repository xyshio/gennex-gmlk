import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { readTree, updateTree } from "@/lib/store";
import { uuid } from "@/lib/uuid";
import {
  MAX_PHOTO_BYTES,
  archiveScanFilePath,
  ensurePersonArchiveDir,
  extForMime,
  isSafePersonId,
} from "@/lib/photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/people/{id}/archive-scans
 *
 * Multipart upload — field `file`. Same size + MIME guards as the
 * profile-photos endpoint; the only difference is the destination
 * directory (`data/archive-scans/{personId}/`) and the Person field
 * it's pushed onto (`archiveScans`). Returns the updated list so the
 * client can patch local state without a refetch.
 */
export async function POST(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  if (!isSafePersonId(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }
  const tree = await readTree();
  if (!tree.persons.some((p) => p.id === id)) {
    return NextResponse.json({ error: "person_not_found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_multipart" }, { status: 400 });
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
  await ensurePersonArchiveDir(id);
  const buf = Buffer.from(await entry.arrayBuffer());
  await fs.writeFile(archiveScanFilePath(id, filename), buf);

  let updated: string[] = [];
  await updateTree((t) => {
    const p = t.persons.find((x) => x.id === id);
    if (p) {
      const next = [...(p.archiveScans ?? []), filename];
      p.archiveScans = next;
      p.updatedAt = new Date().toISOString();
      updated = next;
    }
    return t;
  });

  return NextResponse.json(
    { filename, archiveScans: updated },
    { status: 201 },
  );
}
