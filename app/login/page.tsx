"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Login screen. Single-user app — credentials live in `.env.local` and
 * are validated server-side by `/api/auth/login`. On success the API
 * sets the HttpOnly cookie and we navigate to the `?next=` target (or
 * the dashboard if not present).
 *
 * Standalone layout — no Nav, no AppShell padding — since the user
 * isn't authenticated yet and the rest of the app shouldn't peek out
 * behind the form.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/";
  const { t, locale } = useLocale();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (j.error === "invalid_credentials") {
          throw new Error(
            locale === "pl"
              ? "Niepoprawna nazwa użytkownika lub hasło."
              : "Invalid username or password.",
          );
        }
        if (j.error === "server_misconfigured") {
          throw new Error(
            locale === "pl"
              ? "Brak konfiguracji serwera (.env.local)."
              : "Server is missing required env vars (.env.local).",
          );
        }
        throw new Error(`HTTP ${res.status}`);
      }
      // Push then refresh so the SSR pass on `next` sees the new cookie.
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-10">
      <form
        onSubmit={submit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-ink-border bg-ink-panel p-6 shadow-md"
      >
        <header>
          <h1 className="text-xl font-semibold text-ink-text">
            {locale === "pl" ? "Zaloguj się do gennex" : "Sign in to gennex"}
          </h1>
          <p className="mt-1 text-xs text-ink-muted">
            {locale === "pl"
              ? "Solo aplikacja — dane logowania siedzą w .env.local."
              : "Solo app — credentials live in .env.local."}
          </p>
        </header>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">
            {locale === "pl" ? "Nazwa użytkownika" : "Username"}
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="rounded-md border border-ink-border bg-ink-panel px-3 py-2 text-sm text-ink-text outline-none focus:border-ink-accent focus:ring-2 focus:ring-ink-accent/20"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-muted">
            {locale === "pl" ? "Hasło" : "Password"}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-md border border-ink-border bg-ink-panel px-3 py-2 text-sm text-ink-text outline-none focus:border-ink-accent focus:ring-2 focus:ring-ink-accent/20"
          />
        </label>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-ink-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-ink-accent/90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {t("common.confirm")}
        </button>
      </form>
    </div>
  );
}
