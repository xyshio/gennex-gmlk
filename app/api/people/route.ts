import { NextResponse } from "next/server";
import { readTree, updateTree } from "@/lib/store";
import { uuid } from "@/lib/uuid";
import { PersonInputSchema } from "@/lib/schemas";
import type { Person } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/people — list every person. */
export async function GET() {
  const tree = await readTree();
  return NextResponse.json({ persons: tree.persons });
}

/** POST /api/people — create one. Body matches PersonInputSchema. */
export async function POST(req: Request) {
  const body = await req.json();
  const parsed = PersonInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const now = new Date().toISOString();
  const person: Person = {
    id: uuid(),
    ...parsed.data,
    photos: parsed.data.photos ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await updateTree((tree) => {
    tree.persons.push(person);
    return tree;
  });
  return NextResponse.json({ person }, { status: 201 });
}
