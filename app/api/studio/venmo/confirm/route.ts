// GET /api/studio/venmo/confirm?token=… : the link from the "confirm your new Venmo" email.
// Applies the pending handle, then sends the artist to /studio/money?venmo=confirmed
// (or =expired, =invalid, =taken).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VENMO_CONFIRM_HOURS } from "@/lib/venmo";

export const dynamic = "force-dynamic";

function back(req: NextRequest, result: string) {
  const res = NextResponse.redirect(new URL(`/studio/money?venmo=${result}`, req.nextUrl.origin), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!/^[\w-]{20,64}$/.test(token)) return back(req, "invalid");

  const artist = await prisma.artist.findUnique({
    where: { venmoPendingToken: token },
    select: { id: true, venmoPending: true, venmoPendingAt: true, closedAt: true },
  });
  if (!artist || artist.venmoPending === null || artist.closedAt) return back(req, "invalid");

  const clear = { venmoPending: null, venmoPendingToken: null, venmoPendingAt: null };
  const age = Date.now() - (artist.venmoPendingAt?.getTime() ?? 0);
  if (age > VENMO_CONFIRM_HOURS * 3_600_000) {
    await prisma.artist.update({ where: { id: artist.id }, data: clear });
    return back(req, "expired");
  }

  const next = artist.venmoPending || null; // "" = remove the handle
  if (next) {
    const clash = await prisma.artist.findFirst({ where: { venmoHandle: { equals: next, mode: "insensitive" }, NOT: { id: artist.id } }, select: { id: true } });
    if (clash) {
      await prisma.artist.update({ where: { id: artist.id }, data: clear });
      return back(req, "taken");
    }
  }
  try {
    await prisma.artist.update({ where: { id: artist.id }, data: { venmoHandle: next, ...clear } });
  } catch (err: any) {
    if (err?.code === "P2002") {
      await prisma.artist.update({ where: { id: artist.id }, data: clear });
      return back(req, "taken");
    }
    throw err;
  }
  return back(req, "confirmed");
}
