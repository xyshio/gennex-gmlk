import { Download, FileDown, Info } from "lucide-react";
import { readTree } from "@/lib/store";
import { isParentChild } from "@/lib/graph";

export const dynamic = "force-dynamic";

/**
 * GEDCOM export landing page. One big download button + a summary of
 * what's going into the file so the user can sanity-check before
 * sharing. Nothing client-side here — the download happens via a plain
 * <a href=/api/export/gedcom download> link.
 */
export default async function ExportPage() {
  const tree = await readTree();
  const personCount = tree.persons.length;
  const marriages = tree.relationships.filter(
    (r) => r.type === "marriage",
  ).length;
  const partnerships = tree.relationships.filter(
    (r) => r.type === "partnership",
  ).length;
  const parentChild = tree.relationships.filter(isParentChild).length;
  const empty = personCount === 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Export GEDCOM</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Pack the current tree into a standard{" "}
          <code className="rounded bg-ink-bg px-1 text-[11px]">.ged</code> file
          you can re-import into MyHeritage, Ancestry, FamilySearch or back
          into gennex on another machine. Photos are not included in the file
          — they live as separate binaries under{" "}
          <code className="rounded bg-ink-bg px-1 text-[11px]">data/photos/</code>;
          copy that folder alongside the .ged for a full backup.
        </p>
      </header>

      <section className="rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          What's in the file
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Persons" value={personCount} />
          <Stat label="Marriages" value={marriages} />
          <Stat label="Partnerships" value={partnerships} />
          <Stat label="Parent-child" value={parentChild} />
        </dl>
      </section>

      <section className="rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Download
        </h2>
        {empty ? (
          <p className="mt-3 text-sm italic text-ink-muted">
            Nothing to export yet — add at least one person or import a tree
            first.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href="/api/export/gedcom"
              download
              className="inline-flex items-center gap-2 rounded-md bg-ink-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink-accent/90"
            >
              <FileDown className="h-4 w-4" />
              Download {tree.metadata?.name ?? "family"}.ged
            </a>
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Download className="h-3 w-3" />
              GEDCOM 5.5.1, UTF-8 with BOM, CRLF line endings
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-sky-200 bg-sky-50 p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-sky-900">
          <Info className="h-4 w-4" />
          What rounds-trips and what doesn't
        </h3>
        <ul className="mt-2 ml-5 list-disc space-y-1 text-xs text-sky-900/80">
          <li>
            <strong>Round-trip:</strong> name (with maiden), sex, birth /
            death date + place, notes, parent-child links, marriages (with
            date and divorced flag), partnerships (as custom EVEN block).
          </li>
          <li>
            <strong>Not in the file:</strong> photo binaries, the gennex UUID
            of each person (we synthesize fresh xrefs each time), per-photo
            ordering.
          </li>
          <li>
            <strong>Conventions:</strong> for women whose <code>maidenName</code>
            differs from <code>lastName</code>, the export emits{" "}
            <code>SURN</code> as the maiden surname and <code>_MARNM</code>{" "}
            as the post-marriage surname — exactly the way MyHeritage stores
            it, so re-importing there shows the right "née" annotation.
          </li>
          <li>
            <strong>Need a full backup including photos?</strong> Copy the
            whole <code>data/</code> folder. The .ged file is for sharing /
            interoperability, not for byte-exact preservation.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-ink-border bg-ink-panel p-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-text">
        {value}
      </dd>
    </div>
  );
}
