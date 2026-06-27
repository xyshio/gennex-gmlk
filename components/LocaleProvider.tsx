"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DEFAULT_LOCALE, format, type Locale, type TKey, tFor } from "@/lib/i18n";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, params?: Record<string, string>) => string;
};

const LocaleContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "gennex.locale";

/**
 * Wraps the app, exposes `useLocale()`. Default is Polish; choice
 * persists in localStorage and survives reloads / tab restarts.
 *
 * SSR safety: we render on the server with DEFAULT_LOCALE (so the
 * initial HTML is always Polish), then re-read localStorage on the
 * client after mount. If the stored choice differs, the next render
 * swaps strings — a one-frame Polish→English flash on a non-default
 * setting, which is acceptable for a solo internal tool.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "pl" || stored === "en") setLocaleState(stored);
    } catch {
      // quota / privacy mode — keep the default
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // best-effort persistence
    }
    // Mirror to <html lang> so screen readers and Chrome's
    // translate-bar pick up the change.
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: TKey, params?: Record<string, string>) => {
      return format(tFor(locale, key) /* already formats */, params);
    },
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): Ctx {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used inside LocaleProvider");
  }
  return ctx;
}
