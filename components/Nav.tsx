"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileDown,
  FileUp,
  GitBranch,
  Globe,
  Home,
  LogOut,
  Moon,
  Sun,
  Table2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Top navigation bar. Active route gets the accent underline; the rest
 * are quiet so the family-tree content takes visual priority. Right
 * side stacks: theme toggle, language toggle, logout.
 */
export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const { theme, toggleTheme } = useTheme();
  const tabs = [
    { href: "/", label: t("nav.dashboard"), icon: Home },
    { href: "/people", label: t("nav.people"), icon: Users },
    { href: "/tree", label: t("nav.tree"), icon: GitBranch },
    { href: "/table", label: t("nav.table"), icon: Table2 },
    { href: "/import", label: t("nav.import"), icon: FileUp },
    { href: "/export", label: t("nav.export"), icon: FileDown },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-ink-border bg-ink-panel">
      <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-ink-text"
        >
          gen<span className="text-ink-accent">nex</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-ink-accent/10 font-medium text-ink-accent"
                    : "text-ink-muted hover:bg-ink-bg hover:text-ink-text",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle — sun ↔ moon, persisted in localStorage by
            ThemeProvider. */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-border text-ink-muted transition-colors hover:bg-ink-bg hover:text-ink-text"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Language toggle */}
        <div
          className="inline-flex items-center overflow-hidden rounded-md border border-ink-border text-xs"
          title={t("nav.language")}
        >
          <Globe className="ml-2 mr-1 h-3 w-3 text-ink-muted" />
          <button
            type="button"
            onClick={() => setLocale("pl")}
            className={cn(
              "px-2 py-1 transition-colors",
              locale === "pl"
                ? "bg-ink-accent text-white"
                : "text-ink-muted hover:bg-ink-bg",
            )}
            aria-pressed={locale === "pl"}
          >
            PL
          </button>
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={cn(
              "px-2 py-1 transition-colors",
              locale === "en"
                ? "bg-ink-accent text-white"
                : "text-ink-muted hover:bg-ink-bg",
            )}
            aria-pressed={locale === "en"}
          >
            EN
          </button>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={logout}
          title={locale === "pl" ? "Wyloguj" : "Sign out"}
          aria-label={locale === "pl" ? "Wyloguj" : "Sign out"}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-border text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
