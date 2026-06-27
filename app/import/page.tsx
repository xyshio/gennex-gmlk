"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Stats = {
  indi: number;
  fam: number;
  parentChild: number;
  marriages: number;
  partnerships: number;
};

type ImportResult = {
  mode: "replace" | "append";
  stats: Stats;
  skipped: { tag: string; count: number }[];
  importedPersonIds: string[];
};

/**
 * GEDCOM import wizard. One-screen flow:
 *
 *   1. Pick mode (replace / append) — replace is the common case on
 *      first-time MyHeritage migration; append keeps existing data
 *      and stacks the imported persons on top.
 *   2. Drop / pick a `.ged` file.
 *   3. Watch a spinner while the parser runs server-side.
 *   4. See a stats card with counts + skipped tags + link back to the
 *      people list.
 *
 * No de-dup / merge UI yet — the server treats every imported person
 * as fresh (new UUID). Manual cleanup, if the user re-imports against
 * a populated tree, stays manual for now.
 */
export default function ImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const res = await fetch("/api/import/gedcom", {
        method: "POST",
        body: fd,
      });
      const j = (await res.json()) as ImportResult & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      setResult(j);
      // Refresh server-rendered routes so the dashboard / people list
      // immediately reflect the new contents the next time the user
      // navigates there.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Import GEDCOM</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Load a <code className="rounded bg-ink-bg px-1 text-[11px]">.ged</code>{" "}
          file exported from MyHeritage (Family Trees → Manage trees → ⚙ →{" "}
          <em>Export to GEDCOM</em>) or any other genealogy app that uses
          the 5.5.1 dialect. Persons + relationships are parsed and stored
          in <code className="rounded bg-ink-bg px-1 text-[11px]">data/family.json</code>.
        </p>
      </header>

      <section className="rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Step 1 — Import mode
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ModeCard
            active={mode === "replace"}
            onClick={() => setMode("replace")}
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            label="Replace"
            hint="Wipe existing persons + relationships, install the parsed set. Best for the first import from MyHeritage. Existing photos on disk are left alone."
          />
          <ModeCard
            active={mode === "append"}
            onClick={() => setMode("append")}
            icon={<Upload className="h-4 w-4 text-sky-500" />}
            label="Append"
            hint="Keep existing data, add the parsed set as new rows with fresh UUIDs. No automatic de-duplication."
          />
        </div>
      </section>

      <section className="rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Step 2 — Pick file
        </h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragOver(false);
          }}
          onDrop={onDrop}
          className={cn(
            "mt-3 flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors",
            dragOver
              ? "border-ink-accent bg-ink-accent/5"
              : "border-ink-border bg-ink-bg/40",
          )}
        >
          <FileUp className="h-8 w-8 text-ink-muted" />
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium text-ink-text">{file.name}</p>
              <p className="text-xs text-ink-muted">
                {(file.size / 1024).toFixed(1)} KB
              </p>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="mt-2 text-xs text-ink-muted underline hover:text-ink-text"
              >
                Choose a different file
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-text">
                Drop a <code className="rounded bg-ink-bg px-1 text-[11px]">.ged</code>{" "}
                file here or click below.
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-panel px-3 py-1.5 text-sm hover:bg-ink-bg"
              >
                <Upload className="h-3.5 w-3.5" />
                Browse…
              </button>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".ged,application/x-gedcom,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="flex items-center justify-end gap-3">
        {error && (
          <div className="mr-auto inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={run}
          disabled={!file || busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink-accent/90 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {mode === "replace" ? "Replace tree with file" : "Append file to tree"}
        </button>
      </section>

      {result && <ResultCard result={result} />}
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
        active
          ? "border-ink-accent bg-ink-accent/5"
          : "border-ink-border hover:bg-ink-bg/60",
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
          {hint}
        </span>
      </span>
    </button>
  );
}

function ResultCard({ result }: { result: ImportResult }) {
  const { stats, skipped, mode } = result;
  return (
    <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-5">
      <div className="flex items-center gap-2 text-emerald-800">
        <CheckCircle2 className="h-5 w-5" />
        <h2 className="text-base font-semibold">
          Import finished — {mode === "replace" ? "tree replaced" : "rows appended"}.
        </h2>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Persons" value={stats.indi} />
        <Stat label="Families" value={stats.fam} />
        <Stat label="Parent-child" value={stats.parentChild} />
        <Stat label="Marriages" value={stats.marriages} />
        <Stat label="Partnerships" value={stats.partnerships} />
      </dl>
      {skipped.length > 0 && (
        <details className="mt-4 rounded-md bg-ink-panel/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-ink-text">
            Skipped tags ({skipped.length} kinds)
          </summary>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {skipped.map((s) => (
              <li
                key={s.tag}
                className="flex items-baseline justify-between gap-2 text-ink-muted"
              >
                <code className="text-[11px]">{s.tag}</code>
                <span className="tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-muted/80">
            These tags weren&apos;t mapped to a domain field — usually
            multimedia citations, occupations, residences, sources. Nothing
            crashed; they just aren&apos;t stored.
          </p>
        </details>
      )}
      <div className="mt-4 flex gap-2">
        <a
          href="/people"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-accent/90"
        >
          Open People list
        </a>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-panel px-3 py-1.5 text-xs font-medium hover:bg-ink-bg"
        >
          Back to dashboard
        </a>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-ink-panel/70 p-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-muted">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-text">
        {value}
      </dd>
    </div>
  );
}
