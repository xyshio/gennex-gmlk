"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, GitBranch, Pencil, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import type { Person } from "@/lib/types";

type Props = {
  /** Initial rows from server-rendering. Refetched in the background to
   *  pick up any same-tab edits. */
  initial: Person[];
};

/**
 * Sortable + globally-filterable people table. Reuses `@tanstack/react-table`
 * the same way the SATE projects do. Photo / avatar column is intentionally
 * omitted on this revision — placeholder will land with the upload UI.
 */
export function PeopleTable({ initial }: Props) {
  const { t } = useLocale();
  const { data } = useQuery<Person[]>({
    queryKey: ["people"],
    queryFn: async () => {
      const res = await fetch("/api/people");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { persons: Person[] };
      return j.persons;
    },
    initialData: initial,
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "lastName", desc: false },
  ]);
  const [search, setSearch] = useState("");

  const columns = useMemo<ColumnDef<Person>[]>(
    () => [
      {
        id: "avatar",
        header: "",
        enableSorting: false,
        cell: ({ row }) => <Avatar person={row.original} />,
      },
      {
        id: "lastName",
        accessorKey: "lastName",
        header: t("people.colLast"),
        cell: ({ row }) => {
          const p = row.original;
          return (
            <Link
              href={`/people/${p.id}/edit`}
              className="font-medium text-ink-text hover:text-ink-accent"
            >
              {p.lastName}
              {p.maidenName && (
                <span className="ml-1 text-ink-muted">({p.maidenName})</span>
              )}
            </Link>
          );
        },
      },
      {
        id: "firstName",
        accessorKey: "firstName",
        header: t("people.colFirst"),
      },
      {
        id: "sex",
        accessorKey: "sex",
        header: t("people.colSex"),
        cell: ({ getValue }) => {
          const v = getValue() as Person["sex"];
          if (!v || v === "U") return <span className="text-ink-muted">—</span>;
          return v;
        },
      },
      {
        id: "birthDate",
        accessorKey: "birthDate",
        header: t("people.colBorn"),
        cell: ({ getValue }) => {
          const v = getValue() as string | undefined;
          return v ? <span className="tabular-nums">{v}</span> : <span className="text-ink-muted">—</span>;
        },
      },
      {
        id: "deathDate",
        accessorKey: "deathDate",
        header: t("people.colDied"),
        cell: ({ getValue }) => {
          const v = getValue() as string | undefined;
          return v ? <span className="tabular-nums">{v}</span> : <span className="text-ink-muted">—</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {/* "Show in tree" — URL override so the tree view centers on
                this person without changing the persisted central
                person. */}
            <Link
              href={`/tree?root=${encodeURIComponent(row.original.id)}`}
              className="inline-flex items-center gap-1 rounded-md p-1.5 text-ink-muted hover:bg-ink-accent/10 hover:text-ink-accent"
              title="Show in tree"
              aria-label="Show in tree"
            >
              <GitBranch className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/people/${row.original.id}/edit`}
              className="inline-flex items-center gap-1 rounded-md p-1.5 text-ink-muted hover:bg-ink-accent/10 hover:text-ink-accent"
              title="Edit"
              aria-label="Edit person"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
          </div>
        ),
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("people.filter")}
            className="h-9 w-full rounded-md border border-ink-border bg-ink-panel pl-8 pr-3 text-sm outline-none placeholder:text-ink-muted focus:border-ink-accent focus:ring-2 focus:ring-ink-accent/20"
          />
        </div>
        <div className="text-xs text-ink-muted">
          {table.getFilteredRowModel().rows.length} {t("common.of")}{" "}
          {data?.length ?? 0}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-ink-border bg-ink-panel shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-ink-bg/60">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  return (
                    <th
                      key={h.id}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-ink-muted"
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 transition-colors hover:text-ink-text"
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" && (
                            <ArrowUp className="h-3 w-3" />
                          )}
                          {sorted === "desc" && (
                            <ArrowDown className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-ink-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-ink-muted"
                >
                  {t("people.noMatch")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("transition-colors hover:bg-ink-bg/40")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 32px square — primary photo (photos[0]) if any, otherwise initials on
 * a tinted background. Same shape everywhere we list people so the
 * table / tree / picker stay visually consistent.
 */
function Avatar({ person }: { person: Person }) {
  const first = person.photos[0];
  const initials =
    `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();
  if (first) {
    return (
      <Link href={`/people/${person.id}/edit`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${person.id}/${encodeURIComponent(first)}`}
          alt=""
          className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-border"
          loading="lazy"
        />
      </Link>
    );
  }
  return (
    <Link
      href={`/people/${person.id}/edit`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-accent/15 text-[11px] font-semibold text-ink-accent ring-1 ring-ink-accent/20"
    >
      {initials || "?"}
    </Link>
  );
}
