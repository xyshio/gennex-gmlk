"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * Page-content wrapper. Defaults to the centered max-w-7xl shell used
 * by every page; the Tree view opts into a near-full-width layout
 * (~10px gutters) so big family graphs have room to breathe without
 * pan-scrolling the canvas to find an off-screen ancestor.
 *
 * Pathname-driven so each page doesn't have to opt in manually —
 * one place to change if we want another route to go wide later.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname?.startsWith("/tree");
  return (
    <main
      className={cn(
        wide
          ? "mx-[10px] py-4"
          : "mx-auto max-w-7xl px-4 py-6",
      )}
    >
      {children}
    </main>
  );
}
