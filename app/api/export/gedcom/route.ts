import { readTree } from "@/lib/store";
import { serializeGedcom } from "@/lib/gedcom/serialize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/export/gedcom
 *
 * Reads the current `data/family.json`, serializes to GEDCOM 5.5.1
 * text, and returns it as an attachment download. Filename includes
 * the tree's metadata name + today's date so saved files stay
 * self-describing without an extra header peek.
 */
export async function GET() {
  const tree = await readTree();
  const body = serializeGedcom(tree);
  const safeName = (tree.metadata?.name ?? "family")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 40)
    .replace(/^_|_$/g, "")
    || "family";
  const today = new Date().toISOString().slice(0, 10);
  const filename = `${safeName}_${today}.ged`;

  return new Response(body, {
    status: 200,
    headers: {
      // GEDCOM doesn't have a registered MIME; `text/vnd.familysearch.gedcom`
      // is the convention but browsers handle it the same as text/plain,
      // and the .ged extension is what most importers actually inspect.
      "content-type": "text/vnd.familysearch.gedcom; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
