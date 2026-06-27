import type {
  Marriage,
  ParentChild,
  Partnership,
  Person,
  Relationship,
} from "@/lib/types";

/**
 * Pure helpers for deriving relationship sets from the flat graph.
 *
 * The on-disk shape stores only first-order edges (parent↔child,
 * marriage, partnership). Anything else — siblings, grandparents,
 * cousins, ancestor lines for the tree view — is computed from those.
 * Keeping this in one module means every view (relationships panel,
 * tree, GEDCOM export) derives the same way.
 */

export type PartnerEdge = Marriage | Partnership;

export function isParentChild(r: Relationship): r is ParentChild {
  return r.type === "parent-child";
}

export function isPartnerEdge(r: Relationship): r is PartnerEdge {
  return r.type === "marriage" || r.type === "partnership";
}

/** Parents of `id` (with the relationship row itself for delete / metadata). */
export function getParentEdges(
  id: string,
  rels: Relationship[],
): ParentChild[] {
  return rels.filter((r): r is ParentChild => isParentChild(r) && r.child === id);
}

/** Children of `id`. */
export function getChildEdges(
  id: string,
  rels: Relationship[],
): ParentChild[] {
  return rels.filter(
    (r): r is ParentChild => isParentChild(r) && r.parent === id,
  );
}

/** Marriages + partnerships involving `id` (current AND past). */
export function getPartnerEdges(
  id: string,
  rels: Relationship[],
): PartnerEdge[] {
  return rels.filter(
    (r): r is PartnerEdge =>
      isPartnerEdge(r) && (r.personA === id || r.personB === id),
  );
}

/** Given a partner edge and one side's id, return the other side's id. */
export function otherSideOf(id: string, edge: PartnerEdge): string {
  return edge.personA === id ? edge.personB : edge.personA;
}

/** Build a fast O(1) lookup map from id → person. */
export function indexById(persons: Person[]): Map<string, Person> {
  return new Map(persons.map((p) => [p.id, p]));
}

/** Convenience — short "First Last" label with maiden name suffix. */
export function personLabel(p: Person | undefined): string {
  if (!p) return "(unknown)";
  const base = `${p.firstName} ${p.lastName}`.trim();
  return p.maidenName ? `${base} (${p.maidenName})` : base;
}
