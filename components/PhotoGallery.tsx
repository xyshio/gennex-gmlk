"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  Maximize2,
  Star,
  StarOff,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  personId: string;
  /** Server-rendered initial list of filenames (each = "uuid.ext").
   *  Position 0 is the primary / cover photo. */
  initialPhotos: string[];
};

/**
 * Per-person photo gallery. Renders a grid of thumbnails plus an
 * upload tile. Photos are served from `/api/photos/{personId}/...`,
 * NOT /public, because they live under `data/photos/` for the
 * single-folder backup story.
 *
 * Operations:
 *   - Upload (drag-drop or click)
 *   - Open original in lightbox (click image)
 *   - Set as primary (star icon — moves to position 0)
 *   - Delete (trash icon, with confirm)
 */
export function PhotoGallery({ personId, initialPhotos }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
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
      const res = await fetch(`/api/people/${personId}/photos`, {
        method: "POST",
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as {
        photos?: string[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(j.message ?? j.error ?? `HTTP ${res.status}`);
      }
      return j.photos ?? [];
    },
    onSuccess: (next) => {
      setPhotos(next);
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (filename: string) => {
      setError(null);
      const res = await fetch(
        `/api/people/${personId}/photos/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return filename;
    },
    onSuccess: (filename) => {
      setPhotos((p) => p.filter((f) => f !== filename));
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const setPrimary = useMutation({
    mutationFn: async (filename: string) => {
      setError(null);
      const res = await fetch(
        `/api/people/${personId}/photos/${encodeURIComponent(filename)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ primary: true }),
        },
      );
      const j = (await res.json().catch(() => ({}))) as {
        photos?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      return j.photos ?? [];
    },
    onSuccess: (next) => {
      setPhotos(next);
      refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  async function uploadMany(files: FileList | File[]) {
    // Sequential — keeps the JSON file's mutex happy and produces a
    // stable order of insertions in the photos array.
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f);
      } catch {
        // Single failure stops the batch — error banner already shows.
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
      <header className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">Photos</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Drop images here or click the upload tile. JPEG / PNG / WebP / GIF
            up to 15 MB. The first photo is used as the avatar everywhere
            else in the app.
          </p>
        </div>
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
          // Only un-highlight when leaving the wrapper itself — child
          // hover-leaves would otherwise flicker the border.
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={onDrop}
        className={cn(
          "rounded-md border-2 border-dashed p-3 transition-colors",
          dragOver
            ? "border-ink-accent bg-ink-accent/5"
            : "border-ink-border bg-ink-bg/40",
        )}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          <UploadTile
            pending={upload.isPending}
            onPick={() => fileInputRef.current?.click()}
          />
          {photos.map((filename, idx) => {
            const url = `/api/photos/${personId}/${encodeURIComponent(filename)}`;
            const isPrimary = idx === 0;
            const isRemoving =
              remove.isPending && remove.variables === filename;
            const isPromoting =
              setPrimary.isPending && setPrimary.variables === filename;
            return (
              <div
                key={filename}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-md border bg-ink-panel",
                  isPrimary
                    ? "border-ink-accent ring-2 ring-ink-accent/30"
                    : "border-ink-border",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {isPrimary && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-ink-accent/95 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Star className="h-2.5 w-2.5" />
                    Primary
                  </span>
                )}
                <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/55 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setLightbox(filename)}
                    title="View original"
                    aria-label="View original"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink-panel/95 text-ink-text hover:bg-ink-panel"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => setPrimary.mutate(filename)}
                      disabled={isPromoting}
                      title="Set as primary"
                      aria-label="Set as primary"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink-panel/95 text-amber-600 hover:bg-ink-panel"
                    >
                      {isPromoting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this photo? This cannot be undone.")) {
                        remove.mutate(filename);
                      }
                    }}
                    disabled={isRemoving}
                    title="Delete photo"
                    aria-label="Delete photo"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-ink-panel/95 text-red-600 hover:bg-ink-panel"
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
            // Reset so picking the same file twice still fires.
            e.target.value = "";
          }}
        />
      </div>

      {lightbox && (
        <Lightbox
          src={`/api/photos/${personId}/${encodeURIComponent(lightbox)}`}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}

function UploadTile({
  pending,
  onPick,
}: {
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={pending}
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-ink-border bg-ink-panel text-ink-muted transition-colors hover:border-ink-accent hover:bg-ink-accent/5 hover:text-ink-accent",
        pending && "opacity-60",
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[11px] font-medium">Uploading…</span>
        </>
      ) : (
        <>
          <ImagePlus className="h-6 w-6" />
          <span className="text-[11px] font-medium">Click or drop file</span>
          <span className="text-[10px] opacity-70">JPEG · PNG · WebP · GIF</span>
        </>
      )}
    </button>
  );
}

/**
 * Minimal lightbox — full-viewport black backdrop + image + close.
 * No zoom, no carousel; we'll add those if the user actually misses them.
 */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        title="Close"
        aria-label="Close"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md bg-ink-panel/10 text-white hover:bg-ink-panel/20"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
      />
    </div>
  );
}

// Re-export so future callers can grab the icon set without importing
// from lucide directly when they just need the gallery's contract.
export type { Props as PhotoGalleryProps };
// `Upload` import kept warm for forthcoming "drag overlay" iteration.
export const __unused = Upload;
