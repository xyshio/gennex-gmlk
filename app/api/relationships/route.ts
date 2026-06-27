import { NextResponse } from "next/server";
import { readTree, updateTree } from "@/lib/store";
import { uuid } from "@/lib/uuid";
import { RelationshipInputSchema } from "@/lib/schemas";
import type { Relationship } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/relationships — list everything. */
export async function GET() {
  const tree = await readTree();
  return NextResponse.json({ relationships: tree.relationships });
}

/** POST /api/relationships — create one. Body shape depends on type. */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = RelationshipInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  // Self-reference guard — no person is their own parent / spouse.
  if (data.type === "parent-child" && data.parent === data.child) {
    return NextResponse.json(
      { error: "self_reference", message: "Parent and child must differ" },
      { status: 400 },
    );
  }
  if (data.type !== "parent-child" && data.personA === data.personB) {
    return NextResponse.json(
      { error: "self_reference", message: "Both partners must differ" },
      { status: 400 },
    );
  }
  const rel: Relationship = { id: uuid(), ...data } as Relationship;
  await updateTree((tree) => {
    // Existence check — relationships pointing to non-existent persons
    // would corrupt graph traversal later. Cheaper to reject here.
    const ids = new Set(tree.persons.map((p) => p.id));
    const required =
      data.type === "parent-child"
        ? [data.parent, data.child]
        : [data.personA, data.personB];
    for (const r of required) {
      if (!ids.has(r)) {
        throw Object.assign(new Error("unknown_person"), {
          httpStatus: 400,
          httpBody: { error: "unknown_person", id: r },
        });
      }
    }
    tree.relationships.push(rel);
    return tree;
  }).catch((err) => {
    if (err.httpStatus) throw err;
    throw err;
  });
  return NextResponse.json({ relationship: rel }, { status: 201 });
}
