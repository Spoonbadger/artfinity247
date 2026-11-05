// POST /api/studio/scanning  Book a painting scan (lib/scanning.server.ts createBooking).
// { artworks: [{ artworkId, band }], newPieces: [{ band, count }], handoff: "dropoff" | "pickup", pickupAddress?, preferredDates: ["YYYY-MM-DD"], notes? }
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { createBooking, ScanError } from "@/lib/scanning.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
  const artist = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, closedAt: true, suspendedAt: true } });
  if (!artist || artist.closedAt) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
  if (artist.suspendedAt) return NextResponse.json({ error: "Your account is paused, so scans can't be booked right now.", code: "account_suspended" }, { status: 403 });
  if (!rateLimit(`scan-book:${artist.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "That's a lot of bookings. Wait a bit, or message us.", code: "rate_limited" }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Nothing came through. Refresh and try again.", code: "bad_request" }, { status: 400 });
  try {
    const b = await createBooking(artist.id, body);
    return NextResponse.json({ id: b.id });
  } catch (err) {
    if (err instanceof ScanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[scanning] booking failed", err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
