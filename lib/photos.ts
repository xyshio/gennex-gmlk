import { promises as fs } from "node:fs";
import path from "node:path";
import { STORE_PATHS } from "@/lib/store";

const ARCHIVE_DIR = path.join(STORE_PATHS.dataDir, "archive-scans");

/**
 * Filesystem layout: `data/photos/{personId}/{uuid}.{ext}`. The
 * Person JSON stores the full filename (uuid + ext) in its `photos`
 * array — no need to look up extension separately at serve time.
 */

export const PHOTO_MIME_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export type PhotoExt = keyof typeof PHOTO_MIME_BY_EXT;

/** Reverse map for uploads — MIME → extension. */
const EXT_BY_MIME: Record<string, PhotoExt> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Max payload per upload — protects the JSON-file store from
 *  accidentally getting a single 200 MB photo. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Whitelist-only check on a filename received from a URL. Anything that
 * doesn't match the exact `uuid.ext` shape is rejected — blocks path
 * traversal (`../`, absolute paths, encoded slashes) and odd extensions
 * we don't intend to host.
 */
export function isSafePhotoFilename(name: string): boolean {
  return /^[0-9a-f-]{8,40}\.(jpg|jpeg|png|webp|gif)$/i.test(name);
}

/** Same shape for personId — accepts UUID v4 and our seed-N convention. */
export function isSafePersonId(id: string): boolean {
  return /^[0-9a-zA-Z_-]{1,64}$/.test(id);
}

/** Extension → MIME for the serve route. */
export function mimeForFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (
    (PHOTO_MIME_BY_EXT as Record<string, string>)[ext] ??
    "application/octet-stream"
  );
}

/** MIME → extension for the upload route. Returns null when the
 *  uploaded file is not a supported image. */
export function extForMime(mime: string): PhotoExt | null {
  return EXT_BY_MIME[mime.toLowerCase()] ?? null;
}

/** Absolute path to a single photo file. Caller MUST validate inputs
 *  through the safety checks above before passing them here. */
export function photoFilePath(personId: string, filename: string): string {
  return path.join(STORE_PATHS.photosDir, personId, filename);
}

/** Ensure the per-person photos subdirectory exists. */
export async function ensurePersonPhotoDir(personId: string): Promise<void> {
  await fs.mkdir(path.join(STORE_PATHS.photosDir, personId), {
    recursive: true,
  });
}

/**
 * Archive-scans live under `data/archive-scans/{personId}/` — separate
 * directory from profile photos so a `cp -r data/photos` backup
 * doesn't accidentally pick up archives, and so the user can prune /
 * archive the two categories independently.
 */
export function archiveScanFilePath(
  personId: string,
  filename: string,
): string {
  return path.join(ARCHIVE_DIR, personId, filename);
}

export async function ensurePersonArchiveDir(personId: string): Promise<void> {
  await fs.mkdir(path.join(ARCHIVE_DIR, personId), { recursive: true });
}

export const ARCHIVE_PATHS = { dir: ARCHIVE_DIR } as const;
