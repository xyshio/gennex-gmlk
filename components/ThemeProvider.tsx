"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "gennex.theme";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<Ctx | null>(null);

/**
 * Reads the persisted theme from localStorage on mount and mirrors
 * every change back. The actual first-paint theme is applied BEFORE
 * React hydrates by an inline `<script>` injected in app/layout.tsx
 * — that snippet sets `data-theme="dark"` on <html> if the stored
 * value warrants it, so the user never sees a light→dark flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Sync state with whatever the inline init script wrote on <html>
    // — that's already the source of truth for the first paint.
    const initial =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    setThemeState(initial);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (typeof document !== "undefined") {
      if (t === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // quota / privacy mode — best-effort
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/**
 * Inline script body — emitted in <head> of the root layout so the
 * theme is applied BEFORE the first paint, eliminating the
 * light → dark "flash" you'd otherwise see on dark-mode users.
 */
export const THEME_BOOT_SCRIPT = `
try {
  var t = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
  if (t === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
} catch (e) {}
`;
