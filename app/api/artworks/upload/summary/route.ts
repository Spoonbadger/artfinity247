// POST /api/artworks/upload/summary  { ids: string[] }
// Ends an upload queue (several paintings at once on /studio/art/new): each piece was published with batch=1,
// which held back its "it's live" email, so this sends one summary email for the batch (lib/artworkLive.ts).
// Also called with navigator.sendBeacon when the artist leaves halfway, so the pieces already published are covered.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { announceBatch } from "@/lib/artworkLive";
import { rateLimit } from "@/lib/rateLimit";
import { QUEUE_MAX } from "@/lib/uploadLimits";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`upload-summary:${user.id}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? Array.from(new Set(body.ids.map(String))).slice(0, QUEUE_MAX) as string[] : [];
  if (!ids.length) return NextResponse.json({ live: 0, review: 0 });
  return NextResponse.json(await announceBatch(String(user.id), ids));
}
