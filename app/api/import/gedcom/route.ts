import { NextResponse } from "next/server";
import { updateTree } from "@/lib/store";
import { emptyFamilyTree } from "@/lib/types";
import { parseGedcom } from "@/lib/gedcom/parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_GEDCOM_BYTES = 50 * 1024 * 1024; // 50 MB — comfortable headroom

/**
 * POST /api/import/gedcom
 *
 * Multipart upload of a `.ged` file. The field name is `file`. A
 * second field `mode` chooses between:
 *   - `replace` — wipe persons + relationships, install parsed set.
 *     Photos on disk are left alone (data/photos/{personId}/) — they
 *     belong to the OLD UUIDs that no longer exist, so they end up
 *     as orphans on disk. A future cleanup pass can prune them.
 *   - `append` — keep existing rows and add the parsed set as new
 *     rows. Fresh UUIDs guarantee no collisions even if both trees
 *     reference the same real people; manual de-dup is up to the
 *     user (sensible default — we don't try to guess identity).
 *
 * Returns the parser's stats + skipped-tag inventory so the UI can
 * show a meaningful import-summary screen.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_multipart" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Expected a 'file' part" },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_GEDCOM_BYTES) {
    return NextResponse.json(
      {
        error: "too_large",
        message: `Max ${Math.round(MAX_GEDCOM_BYTES / 1024 / 1024)} MB`,
      },
      { status: 413 },
    );
  }
  const mode = (form.get("mode") as string | null) ?? "replace";
  if (mode !== "replace" && mode !== "append") {
    return NextResponse.json(
      { error: "bad_mode", message: "mode must be 'replace' or 'append'" },
      { status: 400 },
    );
  }

  // GEDCOM is text. MyHeritage emits UTF-8 with BOM (the parser strips
  // it). Reading as text lets the browser/Node handle decoding for us.
  const text = await file.text();
  let result;
  try {
    result = parseGedcom(text);
  } catch (e) {
    console.error("[gedcom import] parse failed:", e);
    return NextResponse.json(
      {
        error: "parse_failed",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    );
  }

  await updateTree((current) => {
    if (mode === "replace") {
      const fresh = emptyFamilyTree(current.metadata.name);
      fresh.persons = result.persons;
      fresh.relationships = result.relationships;
      // Preserve original createdAt so timestamps stay informative
      // through a re-import.
      fresh.metadata.createdAt = current.metadata.createdAt;
      return fresh;
    }
    return {
      ...current,
      persons: [...current.persons, ...result.persons],
      relationships: [...current.relationships, ...result.relationships],
    };
  });

  return NextResponse.json({
    mode,
    stats: result.stats,
    skipped: result.skipped,
    importedPersonIds: result.persons.map((p) => p.id),
  });
}
