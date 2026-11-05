// POST /api/studio/venmo { venmoHandle } : the signed-in artist's Venmo handle for payouts.
//   No handle yet: saved right away.
//   Changing or removing one: held as venmoPending until the artist clicks the link we email
//   (/api/studio/venmo/confirm?token=…, good for 24 hours), so a stolen login can't redirect payouts.
//   Sending the current handle again cancels a pending change.
// DELETE /api/studio/venmo : cancels a pending change.
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { emailHtml } from "@/lib/artistEmails";
import { VENMO_CONFIRM_HOURS, normalizeVenmo, sameVenmo } from "@/lib/venmo";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const IN_USE = "That Venmo handle is already on another Artfinity account. Check the spelling, or message us if it's yours.";

async function me() {
  const user = await getUserFromCookie();
  if (!user?.id) return null;
  const a = await prisma.artist.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, first_name: true, artist_name: true, name: true, venmoHandle: true, closedAt: true },
  });
  return a && !a.closedAt ? a : null;
}

export async function POST(req: Request) {
  const artist = await me();
  if (!artist) return NextResponse.json({ error: "Log in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw = typeof body.venmoHandle === "string" ? body.venmoHandle : "";
  const handle = normalizeVenmo(raw);
  if (handle === undefined) return NextResponse.json({ error: "That Venmo handle looks off. Use letters, numbers, - or _." }, { status: 400 });

  // Same as now: nothing to change; drop any pending change.
  if (sameVenmo(handle, artist.venmoHandle)) {
    await prisma.artist.update({ where: { id: artist.id }, data: { venmoPending: null, venmoPendingToken: null, venmoPendingAt: null } });
    return NextResponse.json({ venmoHandle: artist.venmoHandle, pending: null });
  }

  if (handle) {
    const clash = await prisma.artist.findFirst({ where: { venmoHandle: { equals: handle, mode: "insensitive" }, NOT: { id: artist.id } }, select: { id: true } });
    if (clash) return NextResponse.json({ error: IN_USE }, { status: 400 });
  }

  // First handle: apply directly.
  if (!artist.venmoHandle) {
    try {
      const a = await prisma.artist.update({
        where: { id: artist.id },
        data: { venmoHandle: handle, venmoPending: null, venmoPendingToken: null, venmoPendingAt: null },
        select: { venmoHandle: true },
      });
      return NextResponse.json({ venmoHandle: a.venmoHandle, pending: null });
    } catch (err: any) {
      if (err?.code === "P2002") return NextResponse.json({ error: IN_USE }, { status: 400 });
      throw err;
    }
  }

  // Changing an existing handle: wait for the email confirmation. "" means "remove it".
  const token = randomBytes(24).toString("base64url");
  await prisma.artist.update({
    where: { id: artist.id },
    data: { venmoPending: handle ?? "", venmoPendingToken: token, venmoPendingAt: new Date() },
  });

  const link = `${APP_URL}/api/studio/venmo/confirm?token=${token}`;
  const first = artist.first_name || (artist.artist_name || artist.name || "there").split(" ")[0];
  const what = handle ? `change your payout Venmo from ${artist.venmoHandle} to ${handle}` : `remove ${artist.venmoHandle} as your payout Venmo`;
  const text = [
    `Hi ${first},`,
    `Someone asked to ${what} on Artfinity. To confirm, open this link within ${VENMO_CONFIRM_HOURS} hours:`,
    link,
    `Until you confirm, payouts keep going to ${artist.venmoHandle}.`,
    "Wasn't you? Ignore this email and reset your password right away: " + `${APP_URL}/recover-password`,
  ].join("\n\n");
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Artfinity <no-reply@theartfinity.com>",
      to: artist.email,
      subject: "Confirm your new Venmo for Artfinity payouts",
      html: emailHtml(text, "Artfinity payouts"),
      text,
    });
  } catch (err) {
    console.error("Venmo confirm email failed", err);
    return NextResponse.json({ error: "We couldn't send the confirmation email. Try again in a minute." }, { status: 502 });
  }
  return NextResponse.json({ venmoHandle: artist.venmoHandle, pending: handle ?? "" });
}

export async function DELETE() {
  const artist = await me();
  if (!artist) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  await prisma.artist.update({ where: { id: artist.id }, data: { venmoPending: null, venmoPendingToken: null, venmoPendingAt: null } });
  return NextResponse.json({ venmoHandle: artist.venmoHandle, pending: null });
}
