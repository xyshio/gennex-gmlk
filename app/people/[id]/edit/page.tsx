import Link from "next/link";
import { notFound } from "next/navigation";
import { GitBranch } from "lucide-react";
import { readTree } from "@/lib/store";
import { ArchiveScans } from "@/components/ArchiveScans";
import { CentralPersonButton } from "@/components/CentralPersonButton";
import { PersonForm } from "@/components/PersonForm";
import { PhotoGallery } from "@/components/PhotoGallery";
import { RelationshipsPanel } from "@/components/RelationshipsPanel";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditPersonPage({ params }: Props) {
  const { id } = await params;
  const tree = await readTree();
  const person = tree.persons.find((p) => p.id === id);
  if (!person) notFound();
  const isCentral = tree.metadata.centralPersonId === id;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-end gap-3">
        {/* "Show in tree" — quick jump to /tree centered on this person.
            Uses the URL override (?root=) so it doesn't disturb the
            persisted central-person preference. */}
        <Link
          href={`/tree?root=${encodeURIComponent(id)}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-panel px-3 py-1.5 text-xs font-medium text-ink-text transition-colors hover:border-ink-accent/40 hover:bg-ink-accent/5 hover:text-ink-accent"
        >
          <GitBranch className="h-3.5 w-3.5" />
          Show in tree
        </Link>
        <CentralPersonButton personId={id} isCentral={isCentral} />
      </div>
      <PersonForm initial={person} />
      <PhotoGallery personId={id} initialPhotos={person.photos} />
      <RelationshipsPanel
        personId={id}
        initialPersons={tree.persons}
        initialRelationships={tree.relationships}
      />
      {/* Archive scans live at the BOTTOM — secondary set, not part of
          the avatar / tree-card affordance chain. */}
      <ArchiveScans
        personId={id}
        initialScans={person.archiveScans ?? []}
      />
    </div>
  );
}
