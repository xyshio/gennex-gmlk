import Link from "next/link";
import { readTree } from "@/lib/store";
import { TreeCanvas } from "@/components/TreeCanvas";
import { TreeToolbar } from "@/components/TreeToolbar";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  root?: string;
  up?: string;
  down?: string;
}>;

/**
 * Visual family tree — unified ancestors+descendants view.
 *
 * Root precedence:
 *   1. `?root=ID` URL override (one-off, doesn't persist)
 *   2. `family.json#metadata.centralPersonId` (persistent default,
 *      set via the person edit page's "Set as central person" button)
 *   3. First person alphabetically (so the page is never blank)
 *
 * URL also drives the `up` and `down` depths so any view is bookmarkable.
 */
export default async function TreePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tree = await readTree();

  if (tree.persons.length === 0) {
    return <EmptyTree />;
  }

  const sortedPersons = [...tree.persons].sort((a, b) => {
    const ln = a.lastName.localeCompare(b.lastName);
    return ln !== 0 ? ln : a.firstName.localeCompare(b.firstName);
  });

  // Resolution order: URL → persisted central → alphabetical fallback.
  const urlRoot =
    sp.root && tree.persons.some((p) => p.id === sp.root) ? sp.root : null;
  const persistedRoot =
    tree.metadata.centralPersonId &&
    tree.persons.some((p) => p.id === tree.metadata.centralPersonId)
      ? tree.metadata.centralPersonId
      : null;
  const rootId = urlRoot ?? persistedRoot ?? sortedPersons[0]?.id ?? "";

  const depthUp = clampDepth(sp.up, 3);
  const depthDown = clampDepth(sp.down, 3);

  return (
    <div className="flex flex-col gap-3">
      <TreeToolbar
        persons={sortedPersons}
        rootId={rootId}
        depthUp={depthUp}
        depthDown={depthDown}
      />
      <div className="h-[calc(100vh-160px)] overflow-hidden rounded-lg border border-ink-border bg-ink-panel shadow-sm">
        <TreeCanvas
          persons={tree.persons}
          relationships={tree.relationships}
          rootId={rootId}
          depthUp={depthUp}
          depthDown={depthDown}
        />
      </div>
    </div>
  );
}

function EmptyTree() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-ink-border bg-ink-panel p-10 text-center">
      <p className="text-sm font-medium text-ink-text">
        No people in the tree yet.
      </p>
      <p className="text-xs text-ink-muted">
        Add someone manually or import a GEDCOM file.
      </p>
      <div className="flex gap-2 pt-2">
        <Link
          href="/people/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-accent/90"
        >
          Add person
        </Link>
        <Link
          href="/import"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-panel px-3 py-1.5 text-xs font-medium hover:bg-ink-bg"
        >
          Import GEDCOM
        </Link>
      </div>
    </div>
  );
}

function clampDepth(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(8, Math.round(n)));
}
