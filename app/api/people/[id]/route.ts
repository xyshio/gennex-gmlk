import { NextResponse } from "next/server";
import { readTree, updateTree } from "@/lib/store";
import { PersonInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/people/[id] */
export async function GET(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const tree = await readTree();
  const person = tree.persons.find((p) => p.id === id);
  if (!person) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ person });
}

/** PUT /api/people/[id] — replace mutable fields. */
export async function PUT(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = PersonInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  let updated;
  const next = await updateTree((tree) => {
    const idx = tree.persons.findIndex((p) => p.id === id);
    if (idx === -1) return tree;
    const prev = tree.persons[idx];
    updated = {
      ...prev,
      ...parsed.data,
      photos: parsed.data.photos ?? prev.photos,
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: new Date().toISOString(),
    };
    tree.persons[idx] = updated;
    return tree;
  });
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  void next;
  return NextResponse.json({ person: updated });
}

/** DELETE /api/people/[id] — also drops any relationship that mentions them. */
export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  let removed = false;
  await updateTree((tree) => {
    const before = tree.persons.length;
    tree.persons = tree.persons.filter((p) => p.id !== id);
    removed = tree.persons.length < before;
    if (removed) {
      // Cascade — drop any relationship that referenced the deleted
      // person, otherwise the graph would point to a ghost node.
      tree.relationships = tree.relationships.filter((r) => {
        if (r.type === "parent-child") {
          return r.parent !== id && r.child !== id;
        }
        return r.personA !== id && r.personB !== id;
      });
    }
    return tree;
  });
  if (!removed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
