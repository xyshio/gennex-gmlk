import { redirect } from "next/navigation";

/**
 * Root route is a thin redirect to the tree view — that's the page the
 * user opens 95% of the time, so it doubles as the landing page after
 * login. The middleware gate already enforced auth by the time control
 * reaches here.
 *
 * The previous server-rendered "Dashboard" with summary tiles was nice
 * but added an extra click for the main use case; the dashboard tab
 * was removed from the nav at the same time as this swap.
 */
export default function Home() {
  redirect("/tree");
}
