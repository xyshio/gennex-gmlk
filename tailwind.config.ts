import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // Class-based dark mode is unused — we drive theme via the
  // `[data-theme="dark"]` attribute on <html> + CSS variables in
  // globals.css. The `dark:` variant is still wired in case a one-off
  // override needs to lean on it.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: {
          bg: "rgb(var(--ink-bg) / <alpha-value>)",
          panel: "rgb(var(--ink-panel) / <alpha-value>)",
          border: "rgb(var(--ink-border) / <alpha-value>)",
          text: "rgb(var(--ink-text) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          accent: "rgb(var(--ink-accent) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
