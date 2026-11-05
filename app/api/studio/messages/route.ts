// POST /api/studio/messages: the signed-in artist writes to (or about) one of their customers.
//   { email, mode: "thank_you", body, subject?, orderId?, parcel? } emails the buyer and logs a Message (direction "out").
//   { email, mode: "note", body, orderId? } saves a private note (direction "note"), never emailed.
// GET /api/studio/messages?email=: the thread with one customer.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { rateLimit } from "@/lib/rateLimit";
import { emailHtml, PARCEL_TAG } from "@/lib/artistEmails";
import { safeFromName } from "@/lib/artistEmails.server";
import { getCustomer, getMessages } from "@/app/studio/customers/_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY = 4000;
const MAX_SUBJECT = 150;
const DAILY_SENDS = 40;

async function currentArtist() {
  const user = await getUserFromCookie();
  if (!user?.id) return null;
  return prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, email: true, artist_name: true, name: true } });
}

export async function GET(req: Request) {
  const artist = await currentArtist();
  if (!artist) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Missing email.", code: "invalid_input" }, { status: 400 });
  return NextResponse.json({ messages: await getMessages(artist.id, email) });
}

export async function POST(req: Request) {
  const artist = await currentArtist();
  if (!artist) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });

  const input = await req.json().catch(() => ({}));
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const mode = input.mode === "note" ? "note" : input.mode === "thank_you" ? "thank_you" : null;
  const body = typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim() : "";
  const orderId = typeof input.orderId === "string" && input.orderId ? input.orderId : null;

  if (!email || !mode) return NextResponse.json({ error: "Pick a customer and a note type.", code: "invalid_input" }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Write something first.", code: "missing_content" }, { status: 400 });
  if (body.length > MAX_BODY) return NextResponse.json({ error: `Keep it under ${MAX_BODY} characters.`, code: "too_long" }, { status: 400 });

  // Only people who bought this artist's work.
  const customer = await getCustomer(artist.id, email);
  if (!customer) return NextResponse.json({ error: "Not one of your customers.", code: "not_found" }, { status: 404 });
  const order = orderId ? customer.orders.find((o) => o.id === orderId) : null;
  if (orderId && !order) return NextResponse.json({ error: "That order is not theirs.", code: "invalid_input" }, { status: 400 });

  if (mode === "note") {
    const message = await prisma.message.create({
      data: { artistId: artist.id, email: customer.email, orderId, direction: "note", body },
    });
    return NextResponse.json({ message });
  }

  // Sending email: per-artist burst limit, per-buyer limit, and a daily cap.
  if (!rateLimit(`crm-send:${artist.id}`, 8, 10 * 60_000) || !rateLimit(`crm-send:${artist.id}:${customer.email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "Easy there. Try again in a few minutes.", code: "rate_limited" }, { status: 429 });
  }
  const today = await prisma.message.count({
    where: { artistId: artist.id, direction: "out", sentAt: { gte: new Date(Date.now() - 86_400_000) } },
  });
  if (today >= DAILY_SENDS) return NextResponse.json({ error: "That's today's limit of 40 notes. Try again tomorrow, or save a private note for now.", code: "note_daily_limit" }, { status: 429 });

  const artistName = artist.artist_name || artist.name || "Your artist";
  // Parcel notes only make sense before the print ships.
  const parcel = !!input.parcel && !!order && (order.stage === "paid" || order.stage === "printing");
  const subjectRaw = typeof input.subject === "string" && input.subject.trim() ? input.subject.trim() : `A note from ${artistName}`;
  const subject = subjectRaw.replace(/\s+/g, " ").slice(0, MAX_SUBJECT);
  const footer = `Sent by ${artistName} with Artfinity. Reply to write back to ${artistName.split(" ")[0]}.`;

  try {
    const { error } = await resend.emails.send({
      from: `${safeFromName(artistName)} via Artfinity <notes@theartfinity.com>`,
      to: customer.email,
      replyTo: artist.email,
      subject,
      html: emailHtml(body, footer),
      text: `${body}\n\n--\n${footer}`,
    });
    if (error) throw error;
  } catch (err) {
    console.error("Studio thank-you email failed", err);
    return NextResponse.json({ error: "The note didn't send. Try again in a moment.", code: "send_failed" }, { status: 502 });
  }

  const message = await prisma.message.create({
    data: {
      artistId: artist.id,
      email: customer.email,
      orderId: order?.id ?? null,
      direction: "out",
      subject: parcel ? `${PARCEL_TAG} ${subject}` : subject,
      body,
      sentAt: new Date(),
    },
  });
  return NextResponse.json({ message });
}
