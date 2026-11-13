// Admin roles and what each may do. Pure and client-safe (the server check is lib/adminRoles.ts).
//   owner   everything
//   admin   everything except managing the admin team and settings
//   support views everything; handles orders, reprints, reviews and moderation; no money, suspend/close,
//           DMCA decisions or team changes
export const ADMIN_ROLES = ["owner", "admin", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABEL: Record<AdminRole, string> = { owner: "Owner", admin: "Admin", support: "Support" };
export const ROLE_BLURB: Record<AdminRole, string> = {
  owner: "Everything, including the admin team and settings.",
  admin: "Everything except the admin team and settings.",
  support: "Orders, reprints, reviews and moderation. No money, suspensions, DMCA decisions or team changes.",
};

export type Capability =
  | "view"
  | "orders"
  | "reprints"
  | "reviews"
  | "moderation"
  | "accountSupport" // password reset link, resend email confirmation, sign out everywhere
  | "accounts" // edit name/handle/city, change email, Infinity, create accounts
  | "money" // payouts, pay all, mark paid, refunds
  | "suspend" // suspend/unsuspend, close/reopen
  | "takedown" // DMCA takedowns, counter-notice restores
  | "settings"
  | "team"
  | "deleteAccount"
  | "disconnectOAuth";

const RANK: Record<AdminRole, number> = { support: 1, admin: 2, owner: 3 };

const CAP_MIN: Record<Capability, AdminRole> = {
  view: "support",
  orders: "support",
  reprints: "support",
  reviews: "support",
  moderation: "support",
  accountSupport: "support",
  accounts: "admin",
  money: "admin",
  suspend: "admin",
  takedown: "admin",
  settings: "owner",
  team: "owner",
  deleteAccount: "owner",
  disconnectOAuth: "owner",
};

export const isAdminRole = (v: unknown): v is AdminRole => typeof v === "string" && (ADMIN_ROLES as readonly string[]).includes(v);

/** Stored adminRole → role. An ADMIN without one gets the least access (support). */
export const asAdminRole = (v: unknown): AdminRole => (isAdminRole(v) ? v : "support");

/** May `role` do `need` (a capability, or a minimum role)? */
export function roleCan(role: AdminRole | null | undefined, need: Capability | AdminRole): boolean {
  if (!role) return false;
  const min = isAdminRole(need) ? need : CAP_MIN[need];
  return RANK[role] >= RANK[min];
}

/** Short reason for a disabled button. */
export function cantReason(need: Capability | AdminRole): string {
  const min = isAdminRole(need) ? need : CAP_MIN[need];
  return min === "owner" ? "Only an owner can do this." : "Needs the admin or owner role.";
}
