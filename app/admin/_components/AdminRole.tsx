"use client";
// The signed-in admin's role for client components: hide or disable what the role can't do.
// The API checks again (lib/adminRoles.ts); this is only so nobody clicks a button that will 403.
import { createContext, useContext, type ReactNode } from "react";
import { cantReason, roleCan, type AdminRole, type Capability } from "@/lib/adminCaps";

const Ctx = createContext<AdminRole | null>(null);

export function AdminRoleProvider({ role, children }: { role: AdminRole; children: ReactNode }) {
  return <Ctx.Provider value={role}>{children}</Ctx.Provider>;
}

export const useAdminRole = () => useContext(Ctx);

/** True when the current admin may do `need`. Outside the provider (shouldn't happen) everything is allowed; the API decides. */
export function useAdminCan(need: Capability | AdminRole): boolean {
  const role = useContext(Ctx);
  return role ? roleCan(role, need) : true;
}

/** Renders children only when allowed; otherwise `fallback` (default nothing). */
export function Can({ need, children, fallback = null }: { need: Capability | AdminRole; children: ReactNode; fallback?: ReactNode }) {
  return <>{useAdminCan(need) ? children : fallback}</>;
}

/** A small "why not" note for a disabled control. */
export function CantNote({ need }: { need: Capability | AdminRole }) {
  const can = useAdminCan(need);
  if (can) return null;
  return <span className="t-small">{cantReason(need)}</span>;
}
