"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  UserSearch,
} from "lucide-react";
import { personLabel } from "@/lib/graph";
import { useLocale } from "@/components/LocaleProvider";
import type { Person } from "@/lib/types";
import { PersonPicker } from "./PersonPicker";

type Props = {
  persons: Person[];
  rootId: string;
  depthUp: number;
  depthDown: number;
};

/**
 * Sticky toolbar above the tree canvas. Central person comes from the
 * persisted `family.json#metadata.centralPersonId` (set explicitly via
 * the person edit page — "Set as central person") OR can be temporarily
 * overridden via `?root=` in the URL. URL also drives depthUp /
 * depthDown so any view is shareable.
 */
export function TreeToolbar({ persons, rootId, depthUp, depthDown }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { t } = useLocale();

  const byId = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const root = byId.get(rootId);

  function pushQuery(patch: Record<string, string>) {
    const next = new URLSearchParams(params?.toString());
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    router.replace(`/tree?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-border bg-ink-panel px-4 py-3 shadow-sm">
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md border border-ink-border bg-ink-panel px-3 py-1.5 text-sm transition-colors hover:bg-ink-bg"
        >
          <UserSearch className="h-3.5 w-3.5 text-ink-accent" />
          <span className="text-ink-muted">{t("tree.centralPerson")}</span>
          <span className="font-medium">{personLabel(root)}</span>
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-96">
            <PersonPicker
              persons={persons}
              onPick={(id) => {
                setPickerOpen(false);
                pushQuery({ root: id });
              }}
              onCancel={() => setPickerOpen(false)}
              placeholder={t("tree.pickCentral")}
            />
          </div>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-sm">
        <ArrowUpToLine className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-ink-muted">{t("tree.upGenerations")}</span>
        <select
          value={String(depthUp)}
          onChange={(e) => pushQuery({ up: e.target.value })}
          className="rounded-md border border-ink-border bg-ink-panel px-2 py-1 text-sm outline-none focus:border-ink-accent"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
            <option key={d} value={d}>
              {d === 1 ? `1 ${t("tree.generation")}` : `${d} ${t("tree.generations")}`}
            </option>
          ))}
        </select>
      </label>

      <label className="inline-flex items-center gap-2 text-sm">
        <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-ink-muted">{t("tree.downGenerations")}</span>
        <select
          value={String(depthDown)}
          onChange={(e) => pushQuery({ down: e.target.value })}
          className="rounded-md border border-ink-border bg-ink-panel px-2 py-1 text-sm outline-none focus:border-ink-accent"
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
            <option key={d} value={d}>
              {d === 1 ? `1 ${t("tree.generation")}` : `${d} ${t("tree.generations")}`}
            </option>
          ))}
        </select>
      </label>

      <p className="ml-auto max-w-xs text-[11px] leading-snug text-ink-muted">
        {t("tree.legend")}
      </p>
    </div>
  );
}
