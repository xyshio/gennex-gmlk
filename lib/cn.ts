/**
 * Minimal className joiner. Skips falsy values so conditional classes
 * read cleanly: `cn("base", condition && "extra")`.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
