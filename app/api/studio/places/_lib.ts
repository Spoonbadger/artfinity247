// Shared bits for the Places routes (/api/studio/places, codes/place, hangings, code-prints).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const err = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

/** The signed-in, open artist account's id, or null. */
export async function me() {
  const user = await getUserFromCookie();
  if (!user?.id) return null;
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, closedAt: true } });
  return a && !a.closedAt ? a.id : null;
}

export async function body(req: Request) {
  const b = await req.json().catch(() => null);
  return b && typeof b === "object" ? (b as Record<string, unknown>) : null;
}

export const strings = (v: unknown, max = 500) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s).slice(0, max) : []);

/** A thrown { code: "place_limit" } becomes its message; anything else is a server error. */
export function fail(e: unknown, what: string) {
  if ((e as { code?: string })?.code === "place_limit") return err((e as Error).message, "place_limit", 400);
  console.error(`[places] ${what} failed`, e);
  return err("Couldn't save just now. Try again in a moment.", "server_error", 500);
}
