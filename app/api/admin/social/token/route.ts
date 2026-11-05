// POST /api/admin/social/token  "Check now": reads the Instagram token's health (and refreshes it when it can).
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { igConfigured, tokenHealth } from "@/lib/social/instagram";
import { bad, json } from "../_lib";

export const dynamic = "force-dynamic";

export async function POST() {
  const { admin, denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  if (!igConfigured()) return bad("Instagram isn't connected yet. Follow the setup guide to add the keys.", "instagram_not_connected", 409);
  const h = await tokenHealth(new Date(), true);
  await logAdminAction(admin, "social.token_check", { type: "setting", id: "social" }, `Instagram token: ${h.status}${h.refreshed ? " (refreshed)" : ""}`, { status: h.status, expiresAt: h.expiresAt });
  if (h.status === "expired") return json({ error: "The Instagram token has expired. Make a new one.", code: "ig_token" }, 409);
  return json({ health: h, message: h.refreshed ? "Token refreshed for another 60 days" : h.message });
}
