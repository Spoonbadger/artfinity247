// Server-side admin role checks. Wraps requireAdmin() from lib/auth.ts (which checks the session, sessionVersion,
// closed/suspended and role=ADMIN), then reads the admin's adminRole (owner | admin | support) from the database,
// so a role change applies on the next request without a new login.
//
//   const admin = await requireAdminRole("money")      // throws { status: 401 | 403 }
//   const { admin, denied } = await adminRoleGuard("suspend"); if (denied) return denied;
import { cache } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, type JwtUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { asAdminRole, cantReason, roleCan, type AdminRole, type Capability } from "@/lib/adminCaps";

export type { AdminRole, Capability } from "@/lib/adminCaps";
export { roleCan, ADMIN_ROLES, ROLE_LABEL, isAdminRole } from "@/lib/adminCaps";

export type AdminUser = JwtUser & { adminRole: AdminRole; email?: string };

const roleRow = cache(async (id: string) => prisma.artist.findUnique({ where: { id }, select: { adminRole: true, email: true } }));

/** The signed-in admin with their role. Throws like requireAdmin (401 not signed in, 403 not an admin). */
export async function currentAdmin(): Promise<AdminUser> {
  const u = await requireAdmin();
  const row = await roleRow(u.id);
  if (!row) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return { ...u, email: row.email || u.email, adminRole: asAdminRole(row.adminRole) };
}

/** currentAdmin() that also needs a capability or a minimum role; 403 with a reason otherwise. */
export async function requireAdminRole(need: Capability | AdminRole): Promise<AdminUser> {
  const admin = await currentAdmin();
  if (!roleCan(admin.adminRole, need)) throw Object.assign(new Error(cantReason(need)), { status: 403 });
  return admin;
}

/** For API routes: { admin } or a ready 401/403 JSON response. */
export async function adminRoleGuard(need: Capability | AdminRole = "view"): Promise<{ admin: AdminUser; denied: null } | { admin: null; denied: NextResponse }> {
  try {
    return { admin: await requireAdminRole(need), denied: null };
  } catch (e: any) {
    const status = e?.status === 401 ? 401 : 403;
    const error = status === 401 ? "Not authenticated" : e?.message && e.message !== "Forbidden" ? e.message : "Forbidden";
    return { admin: null, denied: NextResponse.json({ error }, { status }) };
  }
}

/** Never throws: the admin with role, or null. */
export async function getAdminWithRole(): Promise<AdminUser | null> {
  return currentAdmin().catch(() => null);
}
