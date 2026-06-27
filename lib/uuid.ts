/**
 * crypto.randomUUID() is available in Node 19+ and all modern browsers.
 * Wrapped here so any future swap (e.g. ULIDs for lexicographic sort)
 * is a one-file change.
 */
export function uuid(): string {
  return crypto.randomUUID();
}
