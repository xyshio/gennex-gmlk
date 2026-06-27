"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

type Props = {
  personId: string;
  isCentral: boolean;
};

/**
 * "Set / unset as central person" toggle that PUTs to
 * `/api/settings/central-person`. The choice is persistent (lives in
 * `family.json#metadata.centralPersonId`) so the tree-view sticks with
 * the same root until the user explicitly re-pins someone else.
 */
export function CentralPersonButton({ personId, isCentral }: Props) {
  const router = useRouter();
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(personIdOrNull: string | null) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/settings/central-person", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId: personIdOrNull }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  if (isCentral) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("personForm.isCentral")}
        </div>
        <button
          type="button"
          onClick={() => call(null)}
          disabled={pending}
          className="text-[11px] text-ink-muted underline-offset-2 hover:text-ink-text hover:underline disabled:opacity-50"
        >
          {pending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : null}
          {t("personForm.clearCentral")}
        </button>
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => call(personId)}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-panel px-3 py-1.5 text-xs font-medium text-ink-text transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50",
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star className="h-3.5 w-3.5" />
        )}
        {t("personForm.setCentral")}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
