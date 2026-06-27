import { redirect } from "next/navigation";

/**
 * Two-link redirect — the nav "Table" tab is just an alias for the
 * /people page, which IS the tabular view. Kept as a thin redirect so
 * the URL the user shares stays canonical.
 */
export default function TableRedirect() {
  redirect("/people");
}
