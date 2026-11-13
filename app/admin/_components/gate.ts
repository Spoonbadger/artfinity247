import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { currentAdmin, roleCan, type AdminRole, type AdminUser, type Capability } from "@/lib/adminRoles";

/**
 * Server-side admin check. Call it at the top of every admin page as well as the layout:
 * Next renders layouts and pages in parallel, so a layout-only redirect can still stream page data.
 */
export async function adminOrRedirect(next = "/admin") {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect(`/login?next=${encodeURIComponent(next)}`);
  return admin;
}

/** The admin with their role (owner | admin | support). Not signed in → login; missing `need` → /admin?denied=1. */
export async function adminRoleOrRedirect(next = "/admin", need?: Capability | AdminRole): Promise<AdminUser> {
  const admin = await currentAdmin().catch(() => null);
  if (!admin) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (need && !roleCan(admin.adminRole, need)) redirect("/admin?denied=1");
  return admin;
}
