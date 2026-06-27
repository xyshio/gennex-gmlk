"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { personLabel } from "@/lib/graph";
import type { Person } from "@/lib/types";

type Props = {
  /** All persons in the tree. */
  persons: Person[];
  /** IDs to hide from the dropdown (self, already-linked, etc.). */
  excludeIds?: ReadonlySet<string>;
  onPick: (personId: string) => void;
  onCancel: () => void;
  /** Defaults to "Pick a person…". */
  placeholder?: string;
};

/**
 * Search-and-select dropdown for picking another person. Used inside
 * the relationships panel's add forms. Filters by name, maiden name
 * and dates. Keyboard navigation kept simple — arrow ↑↓ + Enter, Esc
 * cancels. Outside-click also cancels.
 */
export function PersonPicker({
  persons,
  excludeIds,
  onPick,
  onCancel,
  placeholder = "Pick a person…",
}: Props) {
  const [search, setSearch] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) onCancel();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onCancel]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const skip = excludeIds ?? new Set<string>();
    return persons
      .filter((p) => !skip.has(p.id))
      .filter((p) => {
        if (!q) return true;
        const hay = [
          p.firstName,
          p.lastName,
          p.maidenName,
          p.birthDate,
          p.deathDate,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => personLabel(a).localeCompare(personLabel(b)))
      .slice(0, 50);
  }, [persons, search, excludeIds]);

  useEffect(() => {
    setActiveIdx(0);
  }, [search]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIdx];
      if (pick) onPick(pick.id);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-ink-border bg-ink-panel pl-8 pr-8 text-sm outline-none placeholder:text-ink-muted focus:border-ink-accent focus:ring-2 focus:ring-ink-accent/20"
        />
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-ink-bg hover:text-ink-text"
          title="Cancel"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1 max-h-64 overflow-y-auto rounded-md border border-ink-border bg-ink-panel shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-xs italic text-ink-muted">
            No matches — try a different search.
          </div>
        ) : (
          <ul className="divide-y divide-ink-border">
            {filtered.map((p, i) => {
              const active = i === activeIdx;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => onPick(p.id)}
                    className={cn(
                      "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                      active && "bg-ink-accent/10 text-ink-accent",
                    )}
                  >
                    <span className="font-medium">{personLabel(p)}</span>
                    {(p.birthDate || p.deathDate) && (
                      <span className="text-[11px] tabular-nums text-ink-muted">
                        {p.birthDate ?? "?"} – {p.deathDate ?? ""}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
