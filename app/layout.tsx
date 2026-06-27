import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppChrome } from "@/components/AppChrome";
import { THEME_BOOT_SCRIPT } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "gennex — family tree",
  description:
    "Solo genealogy app — JSON-file storage, GEDCOM import/export, tree + table views.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // <html lang> defaults to Polish (same as DEFAULT_LOCALE); the
    // LocaleProvider rewrites it on the client after the user flips to
    // English so screen readers + browser-translate pick up the change.
    <html lang="pl">
      <head>
        {/* Apply the saved theme BEFORE first paint so dark-mode users
            never see a light flash on load. The script is intentionally
            tiny and inline — no module import overhead. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-screen bg-ink-bg text-ink-text antialiased">
        <Providers>
          {/* `AppChrome` decides whether to show the Nav + main shell
              (logged-in routes) or render bare children (login page). */}
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
