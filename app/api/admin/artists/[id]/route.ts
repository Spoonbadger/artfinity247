// POST /api/admin/artists/:id  Admin actions on one artist (verification goes through /api/admin/verification/:id).
//   { action: "suspend", reason }   page offline and no new checkouts, until unsuspended
//   { action: "unsuspend" }
//   { action: "reopen" }            undo an account close (lib/account.ts)
//   { action: "grant_infinity", months }
//   { action: "resend_payout_email", month? }   the latest paid month by default
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { reopenArtistAccount } from "@/lib/account";
import { addMonths, formatPlanDate, isProActive } from "@/lib/plans";
import { monthLabel } from "@/lib/balance";
import { resend } from "@/lib/resend";
import PayoutSentEmail from "@/emails/PayoutSentEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM = "Artfinity <notifications@theartfinity.com>";
const CONTACT = process.env.CONTACT_EMAIL || "contact@theartfinity.com";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return fail("Forbidden", 403);
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const artist = await prisma.artist.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, first_name: true, artist_name: true, name: true, role: true, closedAt: true, suspendedAt: true, suspendedReason: true, proUntil: true },
  });
  if (!artist) return fail("Artist not found.", 404);
  const name = artist.artist_name || artist.name;
  const first = artist.first_name || name.split(" ")[0];
  const target = { type: "artist" as const, id: artist.id };

  switch (input.action) {
    case "suspend": {
      const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
      if (!reason) return fail("Add a reason. The artist sees it in Studio.");
      if (artist.role === "ADMIN") return fail("Admins can't be suspended.");
      if (artist.suspendedAt) return fail("Already suspended.", 409);
      // sessionVersion + 1 signs the artist out everywhere; suspended accounts can't log back in (lib/auth.ts).
      const updated = await prisma.artist.update({ where: { id: artist.id }, data: { suspendedAt: new Date(), suspendedReason: reason, sessionVersion: { increment: 1 } }, select: { suspendedAt: true, suspendedReason: true } });
      await resend.emails.send({
        from: FROM, to: artist.email, subject: "Your Artfinity page is paused",
        text: `Hi ${first},\n\nWe've paused your Artfinity page. Your artist page, artwork pages and printed codes are offline for now, and buyers can't check out.\n\nReason: ${reason}\n\nYour earnings are safe and are still paid out on schedule. If you have questions or think this is a mistake, reply to ${CONTACT}.\n\nArtfinity`,
      }).catch((e) => console.error("Suspend email failed", e));
      await logAdminAction(admin, "artist.suspend", target, `Suspended ${name}: ${reason}`, { reason });
      return NextResponse.json({ ok: true, artist: updated });
    }
    case "unsuspend": {
      if (!artist.suspendedAt) return fail("Not suspended.", 409);
      await prisma.artist.update({ where: { id: artist.id }, data: { suspendedAt: null, suspendedReason: null } });
      await resend.emails.send({
        from: FROM, to: artist.email, subject: "Your Artfinity page is back",
        text: `Hi ${first},\n\nYour Artfinity page is live again. Your art and printed codes work as before.\n\nArtfinity`,
      }).catch((e) => console.error("Unsuspend email failed", e));
      await logAdminAction(admin, "artist.unsuspend", target, `Unsuspended ${name}`, { wasReason: artist.suspendedReason, since: artist.suspendedAt });
      return NextResponse.json({ ok: true });
    }
    case "reopen": {
      if (!artist.closedAt) return fail("This account isn't closed.", 409);
      await reopenArtistAccount(artist.id);
      await logAdminAction(admin, "artist.reopen", target, `Reopened ${name}'s closed account`, { closedAt: artist.closedAt });
      return NextResponse.json({ ok: true });
    }
    case "grant_infinity": {
      const months = Math.round(Number(input.months));
      if (!Number.isFinite(months) || months < 1 || months > 24) return fail("Grant between 1 and 24 months.");
      const now = new Date();
      const from = isProActive(artist, now) ? artist.proUntil! : now;
      const proUntil = addMonths(from, months);
      await prisma.artist.update({ where: { id: artist.id }, data: { proUntil } });
      await logAdminAction(admin, "artist.grant_infinity", target, `Granted ${months} month${months === 1 ? "" : "s"} of Infinity (until ${formatPlanDate(proUntil)})`, {
        months, from: artist.proUntil, to: proUntil,
      });
      return NextResponse.json({ ok: true, proUntil, message: `Infinity until ${formatPlanDate(proUntil)}` });
    }
    case "resend_payout_email": {
      const month = typeof input.month === "string" && /^\d{4}-\d{2}$/.test(input.month) ? input.month : null;
      const p = await prisma.payout.findFirst({
        where: { artistId: artist.id, paidAt: { not: null }, ...(month ? { month } : {}) },
        orderBy: { month: "desc" },
        select: { id: true, month: true, amountCents: true, method: true },
      });
      if (!p) return fail("No paid payout to send an email about.", 404);
      const { error } = await resend.emails.send({
        from: FROM,
        to: artist.email,
        subject: `Your Artfinity payout for ${monthLabel(p.month)} has been sent`,
        react: PayoutSentEmail({ artistName: name, month: monthLabel(p.month), amountCents: p.amountCents, via: p.method === "stripe" ? "stripe" : undefined }),
      });
      if (error) return fail("The email didn't send. Try again.", 502);
      await logAdminAction(admin, "payout.resend_email", { type: "payout", id: p.id }, `Resent the ${monthLabel(p.month)} payout email`, { artistId: artist.id, month: p.month, amountCents: p.amountCents });
      return NextResponse.json({ ok: true, month: p.month });
    }
    default:
      return fail("Unknown action.");
  }
}
