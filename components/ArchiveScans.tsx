"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Archive, FilePlus, Loader2, Maximize2, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";

type Props = {
  personId: string;
  initialScans: string[];
};

/**
 * Archive-scans gallery — secondary image set for documents, old
 * family-album photos, gravestone shots, etc. Same upload + lightbox
 * UX as `PhotoGallery` but trimmed: no "primary" semantics, no avatar
 * usage, larger thumbnails (these are documents you actually want to
 * read).
 */
export function ArchiveScans({ personId, initialScans }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { t, locale } = useLocale();
  const [scans, setScans] = useState<string[]>(initialScans);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["people"] });
    router.refresh();
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setError(null);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/people/${personId}/archive-scans`, {
        method: "POST",
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as {
        archiveScans?: string[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      return j.archiveScans ?? [];
    },
    onSuccess: (next) => {
      setScans(next);
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (filename: string) => {
      setError(null);
      const res = await fetch(
        `/api/people/${personId}/archive-scans/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return filename;
    },
    onSuccess: (filename) => {
      setScans((s) => s.filter((f) => f !== filename));
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  async function uploadMany(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f);
      } catch {
        break;
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) {
      void uploadMany(e.dataTransfer.files);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-ink-border bg-ink-panel p-5 shadow-sm">
      <header>
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
          <Archive className="h-4 w-4 text-amber-500" />
          {locale === "pl" ? "Skany archiwalne" : "Archive scans"}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">
          {locale === "pl"
            ? "Skany dokumentów, stare zdjęcia z albumów, dokumenty rodowodowe. Wyświetlają się tylko tutaj — nie są używane jako awatar w drzewie."
            : "Document scans, old album photos, lineage paperwork. Shown only here — never used as the tree-card avatar."}
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

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
          "rounded-md border-2 border-dashed p-3 transition-colors",
          dragOver
            ? "border-amber-500 bg-amber-500/5"
            : "border-ink-border bg-ink-bg/40",
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={upload.isPending}
            className={cn(
              "flex h-40 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-ink-border bg-ink-panel text-ink-muted transition-colors hover:border-amber-500 hover:bg-amber-500/5 hover:text-amber-600",
              upload.isPending && "opacity-60",
            )}
          >
            {upload.isPending ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-[11px] font-medium">
                  {t("photoGallery.uploading")}
                </span>
              </>
            ) : (
              <>
                <FilePlus className="h-7 w-7" />
                <span className="text-xs font-medium">
                  {locale === "pl"
                    ? "Dodaj skan archiwalny"
                    : "Add archive scan"}
                </span>
                <span className="text-[10px] opacity-70">
                  JPEG · PNG · WebP · GIF
                </span>
              </>
            )}
          </button>
          {scans.map((filename) => {
            const url = `/api/archive-scans/${personId}/${encodeURIComponent(filename)}`;
            const isRemoving =
              remove.isPending && remove.variables === filename;
            return (
              <div
                key={filename}
                className="group relative h-40 overflow-hidden rounded-md border border-ink-border bg-ink-panel"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setLightbox(filename)}
                    title={t("photoGallery.viewOriginal")}
                    aria-label={t("photoGallery.viewOriginal")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-ink-text hover:bg-white"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          locale === "pl"
                            ? "Usunąć ten skan? Tej operacji nie można cofnąć."
                            : "Delete this scan? This cannot be undone.",
                        )
                      ) {
                        remove.mutate(filename);
                      }
                    }}
                    disabled={isRemoving}
                    title={t("common.delete")}
                    aria-label={t("common.delete")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-red-600 hover:bg-white"
                  >
                    {isRemoving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void uploadMany(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            title={t("common.close")}
            aria-label={t("common.close")}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/archive-scans/${personId}/${encodeURIComponent(lightbox)}`}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
          />
        </div>
      )}
    </section>
  );
}
