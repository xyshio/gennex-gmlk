"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import type { Person } from "@/lib/types";

type Props = {
  /** When passed, the form runs in edit mode (PUT /api/people/[id]).
   *  Otherwise it creates a new person (POST /api/people). */
  initial?: Person;
};

/**
 * Single-screen create / edit form. The same component handles both
 * paths — the only difference is whether `initial` is passed in.
 * On success it navigates back to the people table; on delete it does
 * the same after a confirmation prompt.
 */
export function PersonForm({ initial }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useLocale();
  const isEdit = !!initial;

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [maidenName, setMaidenName] = useState(initial?.maidenName ?? "");
  const [sex, setSex] = useState<Person["sex"]>(initial?.sex);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? "");
  const [deathDate, setDeathDate] = useState(initial?.deathDate ?? "");
  const [deathPlace, setDeathPlace] = useState(initial?.deathPlace ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        maidenName: maidenName.trim() || undefined,
        sex,
        birthDate: birthDate.trim() || undefined,
        birthPlace: birthPlace.trim() || undefined,
        deathDate: deathDate.trim() || undefined,
        deathPlace: deathPlace.trim() || undefined,
        notes: notes.trim() || undefined,
        photos: initial?.photos ?? [],
      };
      const url = isEdit ? `/api/people/${initial!.id}` : "/api/people";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      router.push("/people");
      router.refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!initial) return;
      const res = await fetch(`/api/people/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      router.push("/people");
      router.refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }

  function onDelete() {
    if (!initial) return;
    const msg = t("personForm.deletePrompt", {
      name: `${initial.firstName} ${initial.lastName}`,
    });
    if (!confirm(msg)) return;
    remove.mutate();
  }

  const pending = save.isPending || remove.isPending;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm"
    >
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold">
          {isEdit ? t("personForm.edit") : t("personForm.add")}
        </h2>
        <Link
          href="/people"
          className="text-xs text-ink-muted hover:underline"
        >
          {t("people.backToList")}
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("personForm.firstName")} required>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label={t("personForm.lastName")} required>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label={t("personForm.maidenName")}>
          <input
            value={maidenName}
            onChange={(e) => setMaidenName(e.target.value)}
            placeholder={t("personForm.maidenHint")}
            className={inputClass}
          />
        </Field>
        <Field label={t("personForm.sex")}>
          <select
            value={sex ?? ""}
            onChange={(e) =>
              setSex((e.target.value || undefined) as Person["sex"])
            }
            className={inputClass}
          >
            <option value="">{t("personForm.sexUnknown")}</option>
            <option value="M">{t("personForm.sexMale")}</option>
            <option value="F">{t("personForm.sexFemale")}</option>
            <option value="U">{t("personForm.sexOther")}</option>
          </select>
        </Field>
        <Field
          label={t("personForm.birthDate")}
          hint={t("personForm.dateHint")}
        >
          <input
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            placeholder="1950-03-12"
            className={inputClass}
          />
        </Field>
        <Field label={t("personForm.birthPlace")}>
          <input
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label={t("personForm.deathDate")}
          hint={t("personForm.deathHint")}
        >
          <input
            value={deathDate}
            onChange={(e) => setDeathDate(e.target.value)}
            placeholder="2010-08-04"
            className={inputClass}
          />
        </Field>
        <Field label={t("personForm.deathPlace")}>
          <input
            value={deathPlace}
            onChange={(e) => setDeathPlace(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label={t("personForm.notes")}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className={cn(inputClass, "font-normal")}
        />
      </Field>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <footer className="flex items-center justify-between gap-2 border-t border-ink-border pt-4">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              {remove.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {t("common.delete")}
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink-accent/90 disabled:opacity-50"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isEdit ? t("common.saveChanges") : t("personForm.createBtn")}
        </button>
      </footer>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-ink-border bg-ink-panel px-3 py-2 text-sm text-ink-text outline-none transition-colors placeholder:text-ink-muted focus:border-ink-accent focus:ring-2 focus:ring-ink-accent/20";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-ink-muted/80">{hint}</span>}
    </label>
  );
}
