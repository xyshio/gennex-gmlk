import { promises as fs } from "node:fs";
import path from "node:path";
import { emptyFamilyTree, type FamilyTree } from "@/lib/types";

/**
 * Single-file JSON store with a write mutex.
 *
 * Lives at `process.cwd()/data/family.json`. The directory `data/`
 * sits next to the running app (Next.js standalone build keeps the
 * relative path), so backup = copy the folder.
 *
 * Concurrency: Next.js API routes run on one Node process (this is
 * a solo app), so a single in-process mutex around writes is enough to
 * prevent lost updates if two requests land back-to-back. The first
 * read is also serialized through the mutex on cold start so two
 * parallel requests can't both write a fresh "empty tree" file.
 *
 * Backup: every successful write also rewrites
 * `data/family.{YYYY-MM-DD}.bak.json` (one backup per day, overwritten
 * within the same day). Daily granularity is the sweet spot for a
 * solo / family-scale dataset — full history lives in git.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "family.json");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");

let writeChain: Promise<void> = Promise.resolve();

async function ensureDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PHOTOS_DIR, { recursive: true });
}

async function readRaw(): Promise<FamilyTree> {
  try {
    const buf = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(buf) as FamilyTree;
    // Defensive: tolerate missing array fields on individual persons
    // — older snapshots may have skipped them entirely.
    for (const p of parsed.persons) {
      if (!Array.isArray(p.photos)) p.photos = [];
      if (!Array.isArray(p.archiveScans)) p.archiveScans = [];
    }
    return parsed;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      const fresh = emptyFamilyTree();
      await ensureDirs();
      await fs.writeFile(FILE, JSON.stringify(fresh, null, 2), "utf8");
      return fresh;
    }
    throw err;
  }
}

async function writeRaw(tree: FamilyTree): Promise<void> {
  tree.metadata.updatedAt = new Date().toISOString();
  await ensureDirs();
  const payload = JSON.stringify(tree, null, 2);
  // Atomic write: write to .tmp then rename. Avoids half-written
  // family.json if the process is killed mid-write.
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, FILE);
  // Daily backup (overwritten within the same day).
  const today = new Date().toISOString().slice(0, 10);
  const bak = path.join(DATA_DIR, `family.${today}.bak.json`);
  await fs.writeFile(bak, payload, "utf8");
}

/**
 * Get the current tree. Multiple concurrent reads are safe.
 */
export async function readTree(): Promise<FamilyTree> {
  return readRaw();
}

/**
 * Run an updater that mutates / replaces the tree. Serialized via
 * the in-process write chain so concurrent updates don't clobber each
 * other. The updater can be sync or async; it MUST return the new
 * tree (or the same object after mutation).
 */
export async function updateTree(
  updater: (tree: FamilyTree) => FamilyTree | Promise<FamilyTree>,
): Promise<FamilyTree> {
  const release = writeChain;
  let resolve!: () => void;
  writeChain = new Promise<void>((r) => (resolve = r));
  try {
    await release;
    const current = await readRaw();
    const next = await updater(current);
    await writeRaw(next);
    return next;
  } finally {
    resolve();
  }
}

export const STORE_PATHS = {
  dataDir: DATA_DIR,
  file: FILE,
  photosDir: PHOTOS_DIR,
} as const;
