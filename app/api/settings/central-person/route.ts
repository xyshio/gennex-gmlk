import { NextResponse } from "next/server";
import { z } from "zod";
import { updateTree } from "@/lib/store";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  /** Pass null to clear. */
  personId: z.string().min(1).max(64).nullable(),
});

/**
 * PUT /api/settings/central-person  body: { personId: string | null }
 *
 * Pins the tree-view's default focal person. Validates the id exists
 * (or accepts null to clear). Stored on `family.json#metadata.centralPersonId`
 * so the choice travels with the tree data — backing up the folder
 * brings the preference along.
 */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  let ok = true;
  await updateTree((tree) => {
    if (parsed.data.personId === null) {
      delete tree.metadata.centralPersonId;
      return tree;
    }
    const found = tree.persons.some((p) => p.id === parsed.data.personId);
    if (!found) {
      ok = false;
      return tree;
    }
    tree.metadata.centralPersonId = parsed.data.personId;
    return tree;
  });
  if (!ok) {
    return NextResponse.json({ error: "person_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
