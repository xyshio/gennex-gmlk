"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Nav } from "@/components/Nav";

/**
 * Outer chrome wrapper. The `/login` route renders bare (no top Nav,
 * no AppShell padding) so the form is centered and the not-yet-
 * authenticated user doesn't see a teaser of the app behind it. Every
 * other route gets the full Nav + AppShell layout.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  if (isLogin) return <>{children}</>;
  return (
    <>
      <Nav />
      <AppShell>{children}</AppShell>
    </>
  );
}
