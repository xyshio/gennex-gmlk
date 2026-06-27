"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import { Archive, Crown, Heart, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import type { TreeNodeData } from "@/lib/treeLayout";

/**
 * Card node for one person in the family-tree canvas. Compact 200×100
 * footprint matching the dagre layout dimensions in `lib/treeLayout.ts`.
 *
 * Per-sex colour band on the left edge keeps the canvas readable at
 * zoomed-out levels (couples become "sky next to pink" pairs at a
 * glance). Root person gets a crown overlay so the user always knows
 * which side of the tree the camera is anchored on.
 */
export function TreeNode({ data }: NodeProps & { data: TreeNodeData }) {
  const { person, isRoot, spouseIds } = data;
  const { t } = useLocale();
  const router = useRouter();
  const [centeringPending, setCenteringPending] = useState(false);

  /**
   * Pin this person as the persisted central person and reload the
   * tree page so the layout rebuilds around them. We push to a clean
   * `/tree` (no `?root=` query) so any prior URL override is dropped
   * — otherwise the page-level resolver would still prefer the URL
   * value over the freshly-saved metadata.centralPersonId.
   */
  async function makeCentral(e: React.MouseEvent) {
    // The card itself is a <Link>. Stop propagation + prevent default
    // so the click doesn't also navigate to the edit page.
    e.preventDefault();
    e.stopPropagation();
    if (centeringPending) return;
    setCenteringPending(true);
    try {
      const res = await fetch("/api/settings/central-person", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: person.id }),
      });
      if (res.ok) {
        router.push("/tree");
        router.refresh();
      } else {
        console.warn(
          "[tree-node] failed to set central person:",
          await res.text().catch(() => ""),
        );
      }
    } catch (err) {
      console.warn("[tree-node] central-person fetch threw:", err);
    } finally {
      setCenteringPending(false);
    }
  }
  const initials =
    `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();
  const sexBand =
    person.sex === "M"
      ? "bg-sky-400"
      : person.sex === "F"
        ? "bg-pink-400"
        : "bg-slate-300";

  // Year-only label under the name. ISO dates may be partial
  // ("1950" / "1950-03" / "1950-03-12") — take the leading 4-digit
  // year either way. Missing birth never renders as "?": when the
  // birth year is unknown, the dash leads ("– 2010"); when alive
  // (birth known, no death), we drop the trailing dash so the
  // common case reads as a single year, not "1950 –".
  const birthYear = yearOf(person.birthDate);
  const deathYear = yearOf(person.deathDate);
  let yearLabel: string | null = null;
  if (birthYear && deathYear) yearLabel = `${birthYear} – ${deathYear}`;
  else if (birthYear) yearLabel = birthYear;
  else if (deathYear) yearLabel = `– ${deathYear}`;

  // React-flow exposes the live zoom as `transform[2]`. At very low
  // zoom levels the card shrinks to a few millimetres and dense text
  // turns to noise — collapse to just the name so the structure of
  // the tree stays readable when the user pans / overviews. The
  // threshold was eyeballed: at ~0.55 the name is still ~7-8 px tall,
  // which is the smallest size where it stays legible.
  const zoom = useStore((s) => s.transform[2]);
  const compact = zoom < 0.55;

  return (
    // Outer wrapper holds badges that need to bleed past the card's
    // rounded border (crown, hidden-parent markers, archive flag).
    // Anything inside the Link is clipped by overflow-hidden so the
    // sex band's corners stay rounded — badges live ONE level up.
    <div className="relative h-[100px] w-[200px]">
    <Link
      href={`/people/${person.id}/edit`}
      className={cn(
        "flex h-full w-full overflow-hidden rounded-lg border bg-ink-panel shadow-sm transition-all hover:shadow-md hover:ring-2 hover:ring-ink-accent/40",
        isRoot
          ? "border-ink-accent ring-2 ring-ink-accent/30"
          : "border-ink-border",
      )}
    >
      {/* Sex band */}
      <span aria-hidden className={cn("w-1.5 shrink-0", sexBand)} />

      {/* Avatar / initials */}
      <div className="flex shrink-0 items-center px-2">
        {person.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/photos/${person.id}/${encodeURIComponent(person.photos[0])}`}
            alt=""
            className="h-12 w-12 rounded-full object-cover ring-1 ring-ink-border"
            loading="lazy"
          />
        ) : (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ink-accent/15 text-sm font-semibold text-ink-accent ring-1 ring-ink-accent/20">
            {initials || "?"}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col justify-center px-1 py-2 pr-3">
        <div className="truncate text-sm font-semibold leading-tight text-ink-text">
          {person.firstName} {person.lastName}
        </div>
        {!compact && person.maidenName && (
          <div className="truncate text-[11px] text-ink-muted">
            {t("tree.nee")} {person.maidenName}
          </div>
        )}
        {!compact && yearLabel && (
          <div className="mt-0.5 truncate text-[11px] tabular-nums text-ink-muted">
            {yearLabel}
          </div>
        )}
        {!compact && spouseIds.length > 0 && (
          <div className="mt-0.5 inline-flex items-center gap-1 truncate text-[10px] text-pink-600">
            <Heart className="h-2.5 w-2.5" />
            {spouseIds.length === 1 ? "partner" : `${spouseIds.length} partners`}
          </div>
        )}
      </div>

      {/* Handles for react-flow — invisible, but required so edges
          have anchor points. We expose handles on all four sides so
          dagre's edge routing can land wherever it wants. */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        type="source"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
        id="left"
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
        id="right"
      />
    </Link>

    {/* === Badges on the OUTER wrapper — not clipped === */}
    {isRoot && (
      <span className="pointer-events-none absolute -top-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
        <Crown className="h-3.5 w-3.5" />
      </span>
    )}

    {/* Center-on-this-person target — bottom-right corner. Hidden on
        the current root (no-op there). Mounted on the OUTER wrapper
        so it sits OUTSIDE the Link, which means a regular click here
        runs `makeCentral` cleanly — no need to fight the surrounding
        navigation handler. */}
    {!isRoot && (
      <button
        type="button"
        onClick={makeCentral}
        disabled={centeringPending}
        title={t("personForm.setCentral")}
        aria-label={t("personForm.setCentral")}
        className="absolute -bottom-2 -right-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-accent text-white opacity-70 shadow-sm ring-2 ring-ink-panel transition-all hover:scale-110 hover:opacity-100 disabled:opacity-50"
      >
        {centeringPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Target className="h-3.5 w-3.5" />
        )}
      </button>
    )}

    {/* Archive-scan flag — small Archive icon in the top-LEFT corner
        when the person has at least one archive scan attached. Mirror
        position of the root crown so the two badges read as a pair. */}
    {person.archiveScans && person.archiveScans.length > 0 && (
      <span
        className="pointer-events-none absolute -top-2 -left-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/95 text-white shadow-sm ring-1 ring-amber-200"
        title="Archive scan available"
        aria-label="Archive scan available"
      >
        <Archive className="h-3.5 w-3.5" />
      </span>
    )}

    {/* Hidden-parent markers — coloured rectangles on the top edge.
        Blue = father, red = mother, slate = unknown-sex parent.
        Visible only when at least one parent exists in the
        relationship graph but isn't drawn in the current depth-up
        window. Sits OUTSIDE the overflow-hidden card so it isn't
        clipped — previous in-card placement made them look 1px tall. */}
    {data.hiddenParentsBySex.length > 0 && (
      <span
        className="pointer-events-none absolute -top-1.5 left-1/2 flex -translate-x-1/2 gap-1"
        aria-label="Parents exist outside the current depth window"
        title={
          data.hiddenParentsBySex
            .map((s) =>
              s === "M"
                ? "father not shown"
                : s === "F"
                  ? "mother not shown"
                  : "parent not shown",
            )
            .join(", ")
        }
      >
        {data.hiddenParentsBySex.map((s) => (
          <span
            key={s}
            className={cn(
              "h-3 w-7 rounded-sm shadow-md ring-2 ring-ink-panel",
              s === "M" && "bg-sky-500",
              s === "F" && "bg-red-500",
              s === "U" && "bg-slate-400",
            )}
          />
        ))}
      </span>
    )}
    </div>
  );
}

/**
 * Pick a 4-digit year off the start of an ISO date string (full or
 * partial — "1950", "1950-03", "1950-03-12" all yield "1950"). Returns
 * undefined for empty / unrecognised input so the caller can branch
 * cleanly on "do we have anything to show".
 */
function yearOf(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined;
  const m = iso.match(/^(\d{4})/);
  return m ? m[1] : undefined;
}
