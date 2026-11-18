// Who a print is for. Server only. An artist prints their own codes; an admin (any role, capability "orders") can
// print for any artist, from that artist's admin page. Admin prints are written to the audit log by the caller.
import { NextResponse } from "next/server";
import { activeUserGuard } from "@/lib/auth";
import { adminRoleGuard, type AdminUser } from "@/lib/adminRoles";
import { prisma } from "@/lib/prisma";

export type PrintAccess =
  | { artistId: string; artistName: string; admin: AdminUser | null; denied: null }
  | { artistId: null; artistName: null; admin: null; denied: NextResponse };

const no = (denied: NextResponse) => ({ artistId: null, artistName: null, admin: null, denied }) as const;

/** `forArtist`: the artist an admin is printing for; empty or the signed-in user's own id = their own codes. */
export async function printAccess(forArtist?: unknown): Promise<PrintAccess> {
  const { user, denied } = await activeUserGuard("Log in to print your codes.");
  if (denied) return no(denied);
  const target = typeof forArtist === "string" && forArtist && forArtist !== user.id ? forArtist : null;
  let admin: AdminUser | null = null;
  if (target) {
    const g = await adminRoleGuard("orders");
    if (g.denied) return no(g.denied);
    admin = g.admin;
  }
  const id = target ?? user.id;
  const a = await prisma.artist.findUnique({ where: { id }, select: { id: true, name: true, artist_name: true, closedAt: true } });
  if (!a || (target && a.closedAt)) return no(NextResponse.json({ error: "That artist's account isn't open.", code: "not_found" }, { status: 404 }));
  return { artistId: a.id, artistName: a.artist_name || a.name || "", admin, denied: null };
}
