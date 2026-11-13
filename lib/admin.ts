// lib/admin.ts (server-side)
// Admin API routes check the admin's role with lib/adminRoles.ts (adminRoleGuard / requireAdminRole), never a bare
// "is any admin" check: support, admin and owner may do different things (lib/adminCaps.ts). The old getAdmin() and
// adminGuard() helpers were removed for that reason.
import { getUserFromCookie } from "@/lib/auth";
import { getAdminWithRole, roleCan } from "@/lib/adminRoles";

/**
 * Who may manage an artist's private data (payout handle, contact info): the artist themself, or an admin with the
 * "accounts" capability (admin or owner, active session). Support can't, since changing a payout handle redirects money.
 */
export async function getArtistManager(artistId: string) {
  const user = await getUserFromCookie();
  if (!user?.id) return { user: null, allowed: false as const };
  if (user.id === artistId) return { user, allowed: true };
  const admin = user.role === "ADMIN" ? await getAdminWithRole() : null;
  return { user, allowed: !!admin && roleCan(admin.adminRole, "accounts") };
}
