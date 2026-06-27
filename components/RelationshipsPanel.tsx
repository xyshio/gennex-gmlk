"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby,
  Heart,
  Loader2,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  getChildEdges,
  getParentEdges,
  getPartnerEdges,
  indexById,
  otherSideOf,
  personLabel,
  type PartnerEdge,
} from "@/lib/graph";
import type { ParentChild, Person, Relationship } from "@/lib/types";
import { PersonPicker } from "./PersonPicker";

type Props = {
  personId: string;
  /** Initial server-rendered data. The panel refetches in the
   *  background to pick up edits made elsewhere in the session. */
  initialPersons: Person[];
  initialRelationships: Relationship[];
};

type AddMode =
  | null
  | { kind: "parent" }
  | { kind: "child" }
  | { kind: "partner"; partnerType: "marriage" | "partnership" };

export function RelationshipsPanel({
  personId,
  initialPersons,
  initialRelationships,
}: Props) {
  const router = useRouter();
  const qc = useQueryClient();

  const peopleQ = useQuery<Person[]>({
    queryKey: ["people"],
    queryFn: async () => {
      const res = await fetch("/api/people");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { persons: Person[] };
      return j.persons;
    },
    initialData: initialPersons,
  });

  const relQ = useQuery<Relationship[]>({
    queryKey: ["relationships"],
    queryFn: async () => {
      const res = await fetch("/api/relationships");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { relationships: Relationship[] };
      return j.relationships;
    },
    initialData: initialRelationships,
  });

  const persons = peopleQ.data ?? [];
  const rels = relQ.data ?? [];
  const byId = indexById(persons);
  const self = byId.get(personId);

  const parentEdges = getParentEdges(personId, rels);
  const childEdges = getChildEdges(personId, rels);
  const partnerEdges = getPartnerEdges(personId, rels);

  const [adding, setAdding] = useState<AddMode>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      setError(null);
      const res = await fetch("/api/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      setAdding(null);
      router.refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (relId: string) => {
      setError(null);
      const res = await fetch(`/api/relationships/${relId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      router.refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!self) return null;

  // IDs to hide from each picker — never let the user pick themselves
  // or someone already linked the same way.
  const skipParents = new Set<string>([
    personId,
    ...parentEdges.map((e) => e.parent),
  ]);
  const skipChildren = new Set<string>([
    personId,
    ...childEdges.map((e) => e.child),
  ]);
  const skipPartners = new Set<string>([
    personId,
    ...partnerEdges.map((e) => otherSideOf(personId, e)),
  ]);

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm">
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">Relationships</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Edit the family graph around{" "}
            <span className="font-medium text-ink-text">
              {personLabel(self)}
            </span>
            . Adding here updates the canonical relationships table —
            siblings / cousins / grandparents are derived from it
            automatically.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Parents */}
      <RelSection
        icon={<UserRound className="h-4 w-4 text-sky-500" />}
        title="Parents"
        emptyLabel="No parents recorded yet."
        items={parentEdges.map((e) => ({
          edge: e,
          otherId: e.parent,
          subline: e.adoptive ? "adoptive" : undefined,
        }))}
        byId={byId}
        onAddClick={() => {
          setAdding({ kind: "parent" });
          setError(null);
        }}
        adding={adding?.kind === "parent"}
        onCancel={() => setAdding(null)}
        renderAddForm={() => (
          <AddParentChildForm
            label="Add parent"
            persons={persons}
            excludeIds={skipParents}
            onSubmit={(otherId, adoptive) =>
              create.mutate({
                type: "parent-child",
                parent: otherId,
                child: personId,
                adoptive: adoptive || undefined,
              })
            }
            pending={create.isPending}
            onCancel={() => setAdding(null)}
          />
        )}
        onRemove={(relId) => remove.mutate(relId)}
        removingId={remove.isPending ? remove.variables : null}
      />

      {/* Partners (marriage + partnership) */}
      <RelSection
        icon={<Heart className="h-4 w-4 text-pink-500" />}
        title="Partners"
        emptyLabel="No marriages or partnerships recorded yet."
        items={partnerEdges.map((e) => ({
          edge: e,
          otherId: otherSideOf(personId, e),
          subline: partnerSubline(e),
        }))}
        byId={byId}
        onAddClick={() => {
          setAdding({ kind: "partner", partnerType: "marriage" });
          setError(null);
        }}
        adding={adding?.kind === "partner"}
        onCancel={() => setAdding(null)}
        renderAddForm={() => (
          <AddPartnerForm
            persons={persons}
            excludeIds={skipPartners}
            onSubmit={(otherId, partnerType, from, to, divorced) =>
              create.mutate({
                type: partnerType,
                personA: personId,
                personB: otherId,
                from: from || undefined,
                to: to || undefined,
                divorced: partnerType === "marriage" ? !!divorced : undefined,
              })
            }
            pending={create.isPending}
            onCancel={() => setAdding(null)}
          />
        )}
        onRemove={(relId) => remove.mutate(relId)}
        removingId={remove.isPending ? remove.variables : null}
      />

      {/* Children */}
      <RelSection
        icon={<Baby className="h-4 w-4 text-emerald-500" />}
        title="Children"
        emptyLabel="No children recorded yet."
        items={childEdges.map((e) => ({
          edge: e,
          otherId: e.child,
          subline: e.adoptive ? "adoptive" : undefined,
        }))}
        byId={byId}
        onAddClick={() => {
          setAdding({ kind: "child" });
          setError(null);
        }}
        adding={adding?.kind === "child"}
        onCancel={() => setAdding(null)}
        renderAddForm={() => (
          <AddParentChildForm
            label="Add child"
            persons={persons}
            excludeIds={skipChildren}
            onSubmit={(otherId, adoptive) =>
              create.mutate({
                type: "parent-child",
                parent: personId,
                child: otherId,
                adoptive: adoptive || undefined,
              })
            }
            pending={create.isPending}
            onCancel={() => setAdding(null)}
          />
        )}
        onRemove={(relId) => remove.mutate(relId)}
        removingId={remove.isPending ? remove.variables : null}
      />
    </section>
  );
}

// ---------- Section + add forms (local helpers) ----------------------

function RelSection({
  icon,
  title,
  emptyLabel,
  items,
  byId,
  onAddClick,
  adding,
  onCancel,
  renderAddForm,
  onRemove,
  removingId,
}: {
  icon: React.ReactNode;
  title: string;
  emptyLabel: string;
  items: Array<{
    edge: Relationship;
    otherId: string;
    subline?: string;
  }>;
  byId: Map<string, Person>;
  onAddClick: () => void;
  adding: boolean;
  onCancel: () => void;
  renderAddForm: () => React.ReactNode;
  onRemove: (relId: string) => void;
  removingId: string | null | undefined;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
          <span className="ml-1 rounded-full bg-ink-bg px-1.5 text-[10px] font-medium tabular-nums text-ink-muted">
            {items.length}
          </span>
        </h3>
        {!adding ? (
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center gap-1 rounded-md border border-ink-border px-2 py-1 text-xs font-medium text-ink-text transition-colors hover:bg-ink-bg"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-md border border-ink-border px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-ink-bg"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        )}
      </div>
      {adding && <div className="mb-3">{renderAddForm()}</div>}
      {items.length === 0 ? (
        <p className="text-xs italic text-ink-muted">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-ink-border rounded-md border border-ink-border">
          {items.map(({ edge, otherId, subline }) => {
            const other = byId.get(otherId);
            const removing = removingId === edge.id;
            return (
              <li
                key={edge.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <Link
                    href={`/people/${otherId}/edit`}
                    className="block truncate text-sm font-medium text-ink-text hover:text-ink-accent"
                  >
                    {personLabel(other)}
                  </Link>
                  {subline && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {subline}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Remove this relationship? The persons stay; only the link is deleted.`,
                      )
                    ) {
                      onRemove(edge.id);
                    }
                  }}
                  disabled={removing}
                  title="Remove relationship"
                  aria-label="Remove relationship"
                  className={cn(
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600",
                    removing && "opacity-50",
                  )}
                >
                  {removing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddParentChildForm({
  label,
  persons,
  excludeIds,
  onSubmit,
  pending,
  onCancel,
}: {
  label: string;
  persons: Person[];
  excludeIds: Set<string>;
  onSubmit: (otherId: string, adoptive: boolean) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [adoptive, setAdoptive] = useState(false);

  if (!pickedId) {
    return (
      <PersonPicker
        persons={persons}
        excludeIds={excludeIds}
        onPick={setPickedId}
        onCancel={onCancel}
        placeholder={label}
      />
    );
  }

  const picked = persons.find((p) => p.id === pickedId);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-ink-accent/30 bg-ink-accent/5 p-3">
      <div className="text-sm">
        <span className="text-ink-muted">{label}:</span>{" "}
        <span className="font-medium">{personLabel(picked)}</span>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={adoptive}
          onChange={(e) => setAdoptive(e.target.checked)}
        />
        Adoptive / step (not biological)
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPickedId(null)}
          className="rounded-md border border-ink-border px-2.5 py-1 text-xs hover:bg-ink-bg"
        >
          Change person
        </button>
        <button
          type="button"
          onClick={() => onSubmit(pickedId, adoptive)}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-ink-accent/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

function AddPartnerForm({
  persons,
  excludeIds,
  onSubmit,
  pending,
  onCancel,
}: {
  persons: Person[];
  excludeIds: Set<string>;
  onSubmit: (
    otherId: string,
    partnerType: "marriage" | "partnership",
    from: string,
    to: string,
    divorced: boolean,
  ) => void;
  pending: boolean;
  onCancel: () => void;
}) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [partnerType, setPartnerType] = useState<"marriage" | "partnership">(
    "marriage",
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [divorced, setDivorced] = useState(false);

  if (!pickedId) {
    return (
      <PersonPicker
        persons={persons}
        excludeIds={excludeIds}
        onPick={setPickedId}
        onCancel={onCancel}
        placeholder="Add partner"
      />
    );
  }

  const picked = persons.find((p) => p.id === pickedId);
  return (
    <div className="flex flex-col gap-3 rounded-md border border-ink-accent/30 bg-ink-accent/5 p-3">
      <div className="text-sm">
        <span className="text-ink-muted">With:</span>{" "}
        <span className="font-medium">{personLabel(picked)}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink-muted">Relationship type</span>
          <select
            value={partnerType}
            onChange={(e) =>
              setPartnerType(e.target.value as "marriage" | "partnership")
            }
            className="h-8 rounded-md border border-ink-border bg-ink-panel px-2 text-sm outline-none focus:border-ink-accent"
          >
            <option value="marriage">Marriage</option>
            <option value="partnership">Partnership (unmarried)</option>
          </select>
        </label>
        {partnerType === "marriage" && (
          <label className="flex items-end gap-2 pb-1 text-xs">
            <input
              type="checkbox"
              checked={divorced}
              onChange={(e) => setDivorced(e.target.checked)}
            />
            Divorced
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink-muted">From</span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="YYYY[-MM[-DD]]"
            className="h-8 rounded-md border border-ink-border bg-ink-panel px-2 text-sm outline-none focus:border-ink-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-ink-muted">To (if ended)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="YYYY[-MM[-DD]]"
            className="h-8 rounded-md border border-ink-border bg-ink-panel px-2 text-sm outline-none focus:border-ink-accent"
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPickedId(null)}
          className="rounded-md border border-ink-border px-2.5 py-1 text-xs hover:bg-ink-bg"
        >
          Change person
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmit(pickedId, partnerType, from.trim(), to.trim(), divorced)
          }
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-ink-accent/90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
          Save
        </button>
      </div>
    </div>
  );
}

function partnerSubline(e: PartnerEdge): string {
  const parts: string[] = [];
  parts.push(e.type === "marriage" ? "Marriage" : "Partnership");
  if (e.from) parts.push(`from ${e.from}`);
  if (e.to) parts.push(`to ${e.to}`);
  if (e.type === "marriage" && (e as { divorced?: boolean }).divorced) {
    parts.push("• divorced");
  }
  return parts.join(" ");
}

// Stop the unused-import warning since the type is used in a typeguard
// only via its narrow signature — kept here as a re-export so future
// callers can grab it without dipping into lib/graph.ts.
export type { ParentChild };
