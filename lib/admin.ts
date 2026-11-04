// lib/admin.ts (server-side)
// Small wrappers around the shared auth helpers so API routes don't each
// re-implement JWT checks.
import { NextResponse } from "next/server";
import { getUserFromCookie, requireAdmin } from "@/lib/auth";

/** The logged-in admin, or null (no cookie, bad/expired token, or not ADMIN). Never throws. */
export async function getAdmin() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

/**
 * Who may manage an artist's private data (payout handle, contact info):
 * the artist themself or an ADMIN.
 */
export async function getArtistManager(artistId: string) {
  const user = await getUserFromCookie();
  if (!user?.id) return { user: null, allowed: false as const };
  const allowed = user.id === artistId || user.role === "ADMIN";
  return { user, allowed };
}

/**
 * For routes that only admins may call. Returns a ready 401/403 JSON response
 * to send back, or null when the caller is an admin.
 *   const denied = await adminGuard(); if (denied) return denied
 */
export async function adminGuard(): Promise<NextResponse | null> {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
