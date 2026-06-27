import { NextResponse } from "next/server";
import { updateTree } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** DELETE /api/relationships/[id] */
export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  let removed = false;
  await updateTree((tree) => {
    const before = tree.relationships.length;
    tree.relationships = tree.relationships.filter((r) => r.id !== id);
    removed = tree.relationships.length < before;
    return tree;
  });
  if (!removed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
