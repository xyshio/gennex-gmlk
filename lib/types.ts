/**
 * Domain model — kept deliberately small and explicit. Derived
 * relationships (siblings, grandparents, cousins...) are NOT stored —
 * they're computed from the `relationships` graph in `lib/graph.ts` so
 * we never have to keep two sources of truth in sync.
 */

export type Sex = "M" | "F" | "U";

export type Person = {
  /** UUID. Stable across imports/exports. */
  id: string;
  firstName: string;
  lastName: string;
  /** Maiden / birth surname when different from `lastName`. */
  maidenName?: string;
  sex?: Sex;
  /** ISO date or partial — "1950", "1950-03", "1950-03-12" are all OK. */
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  notes?: string;
  /** UUIDs of photo files under data/photos/{personId}/{uuid}.jpg.
   *  Position 0 is the avatar / primary photo. */
  photos: string[];
  /** Secondary image set — scans of archival documents (birth
   *  certificates, old family photos from albums, gravestone shots).
   *  Stored on disk next to the profile photos but kept in a separate
   *  list so the avatar / tree-card logic doesn't accidentally pull
   *  them in. Rendered at the bottom of the person edit page; the
   *  tree-card surfaces only a small "archive" icon when one exists. */
  archiveScans?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ParentChild = {
  id: string;
  type: "parent-child";
  parent: string;
  child: string;
  /** Non-biological parent (adoptive, step). Default false / absent. */
  adoptive?: boolean;
};

export type Marriage = {
  id: string;
  type: "marriage";
  personA: string;
  personB: string;
  /** Wedding date (partial OK). */
  from?: string;
  /** End date — divorce or death of one spouse. */
  to?: string;
  divorced?: boolean;
};

export type Partnership = {
  id: string;
  type: "partnership";
  personA: string;
  personB: string;
  from?: string;
  to?: string;
};

export type Relationship = ParentChild | Marriage | Partnership;

export type FamilyTree = {
  /** Bump when the on-disk shape changes incompatibly. */
  version: 1;
  metadata: {
    name: string;
    createdAt: string;
    updatedAt: string;
    /** The "central" person the Tree view is anchored on by default
     *  (everyone else is displayed relative to them — ancestors above,
     *  descendants below). Persists with the tree data so it survives
     *  across browsers / re-imports. */
    centralPersonId?: string;
  };
  persons: Person[];
  relationships: Relationship[];
};

/** Empty-but-valid tree for first-run / fresh-install. */
export function emptyFamilyTree(name = "My Family"): FamilyTree {
  const now = new Date().toISOString();
  return {
    version: 1,
    metadata: { name, createdAt: now, updatedAt: now },
    persons: [],
    relationships: [],
  };
}
