import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

/**
 * Server-side admin check. Call it at the top of every admin page as well as the layout:
 * Next renders layouts and pages in parallel, so a layout-only redirect can still stream page data.
 */
export async function adminOrRedirect(next = "/admin") {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect(`/login?next=${encodeURIComponent(next)}`);
  return admin;
}
