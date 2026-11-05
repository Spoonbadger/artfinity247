// POST /api/studio/newsletter { action: "save" | "test" | "send", id?, subject, body, artworkIds }
//   save: keeps a draft. test: emails the artist. send: saves, then sends to confirmed followers (1 per 24h).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { UNVERIFIED_MESSAGE } from "@/lib/emailVerify";
import { rateLimit } from "@/lib/rateLimit";
import { activeFollowerCount } from "@/lib/followers";
import { MAX_ARTWORKS, MAX_BODY, MAX_SUBJECT } from "@/lib/newsletter";
import { nextSendAt, sendNewsletter, sendTestNewsletter, SendTooSoonError } from "@/lib/newsletter.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  action: z.enum(["save", "test", "send"]),
  id: z.string().max(40).nullish(),
  subject: z.string().trim().max(MAX_SUBJECT),
  body: z.string().transform((s) => s.replace(/\r\n/g, "\n").trim()).pipe(z.string().max(MAX_BODY)),
  artworkIds: z.array(z.string().max(40)).max(MAX_ARTWORKS).default([]),
});

const when = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const artist = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, slug: true, artist_name: true, name: true, profileImage: true, email: true, closedAt: true, emailVerifiedAt: true } });
  if (!artist || artist.closedAt) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the subject and text.", code: "invalid_input" }, { status: 400 });
  const { action, id, subject, body } = parsed.data;
  // Only the artist's own pieces.
  const owned = await prisma.artwork.findMany({ where: { id: { in: parsed.data.artworkIds }, artistId: artist.id }, select: { id: true } });
  const artworkIds = parsed.data.artworkIds.filter((a) => owned.some((o) => o.id === a));

  // Sending (and test sends, which go to the account's email) waits for a confirmed email. Drafts are fine.
  if (action !== "save" && !artist.emailVerifiedAt) return NextResponse.json({ error: UNVERIFIED_MESSAGE, code: "email_unverified" }, { status: 403 });
  if (action !== "save" && (!subject || !body)) return NextResponse.json({ error: "Add a subject and a few words first.", code: "missing_content" }, { status: 400 });

  if (action === "test") {
    if (!rateLimit(`nl-test:${artist.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "That's a lot of tests. Try again in an hour.", code: "rate_limited" }, { status: 429 });
    try {
      await sendTestNewsletter(artist, { subject, body, artworkIds });
    } catch (err) {
      console.error("[newsletter] test failed", err);
      return NextResponse.json({ error: "The test email didn't go out. Try again in a moment.", code: "send_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, to: artist.email });
  }

  if (action === "send") {
    const next = await nextSendAt(artist.id);
    if (next) return NextResponse.json({ error: `One newsletter a day. You can send again ${when(next)}. Save this as a draft for then.`, code: "daily_limit", next: next.toISOString() }, { status: 429 });
    // Nobody to send to: say so before saving anything as "sent".
    const followers = await activeFollowerCount(artist.id);
    if (!followers) return NextResponse.json({ error: "No confirmed followers yet. Share your follow link or add the people who signed up with you, then send.", code: "no_followers" }, { status: 409 });
  }

  // Save (draft) — a sent newsletter is never edited.
  const existing = id ? await prisma.newsletter.findFirst({ where: { id, artistId: artist.id } }) : null;
  if (existing?.sentAt) return NextResponse.json({ error: "That one's already sent. Start a new newsletter instead.", code: "already_sent" }, { status: 409 });
  const data = { subject, body, artworkIds };
  const saved = existing
    ? await prisma.newsletter.update({ where: { id: existing.id }, data })
    : await prisma.newsletter.create({ data: { ...data, artistId: artist.id } });
  if (action === "save") return NextResponse.json({ ok: true, id: saved.id });

  try {
    const r = await sendNewsletter(artist, saved.id);
    return NextResponse.json({ ok: true, id: saved.id, ...r });
  } catch (err) {
    if (err instanceof SendTooSoonError) return NextResponse.json({ error: `One newsletter a day. You can send again ${when(err.next)}. Save this as a draft for then.`, code: "daily_limit", next: err.next.toISOString() }, { status: 429 });
    console.error("[newsletter] send failed", err);
    return NextResponse.json({ error: "Sending failed. Try again in a moment. If it keeps happening, message us from Help.", code: "send_failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  await prisma.newsletter.deleteMany({ where: { id, artistId: user.id, sentAt: null } });
  return NextResponse.json({ ok: true });
}
