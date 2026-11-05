// POST /api/admin/reports/:id  { action: "takedown" | "dismiss" | "restore", note? }
// Admin decision on an art report or DMCA counter-notice. Emails the people involved.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { REASON_SHORT, SITE_URL, type AnyReason } from "@/lib/reports";
import { artUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

const FROM = "Artfinity <notifications@theartfinity.com>";

// What the artist sees in Studio next to the taken-down piece.
const TAKEDOWN_REASON: Record<string, string> = {
  copyright: "Removed after a copyright (DMCA) notice",
  ai: "Removed: reported as AI-made but sold as hand-made",
  offensive: "Removed: breaks our content rules",
  other: "Removed after a report",
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { action?: string; note?: string } | null;
  const action = body?.action;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (action !== "takedown" && action !== "dismiss" && action !== "restore") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const report = await prisma.artReport.findUnique({
    where: { id: params.id },
    select: {
      id: true, reason: true, status: true, name: true, email: true, artworkUrl: true,
      artwork: { select: { id: true, slug: true, title: true, status: true, flaggedBy: true, artist: { select: { slug: true, email: true, first_name: true, artist_name: true, name: true } } } },
    },
  });
  if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (report.status !== "open") return NextResponse.json({ error: "This report is already closed." }, { status: 409 });

  const counter = report.reason === "counter";
  if (action === "takedown" && counter) return NextResponse.json({ error: "Counter-notices can be restored or dismissed." }, { status: 400 });
  if (action === "restore" && !counter) return NextResponse.json({ error: "Only counter-notices can restore work." }, { status: 400 });
  if ((action === "takedown" || action === "restore") && !report.artwork) {
    return NextResponse.json({ error: "This report isn’t linked to a piece on Artfinity. Find it in Moderation instead." }, { status: 409 });
  }

  const art = report.artwork;
  const artist = art?.artist;
  const artistFirst = artist ? artist.first_name || (artist.artist_name || artist.name).split(" ")[0] : "";
  const reporterFirst = report.name.split(" ")[0];
  const title = art ? `“${art.title}”` : "the art you reported";
  const now = new Date();
  const mails: Parameters<typeof resend.emails.send>[0][] = [];

  if (action === "takedown" && art && artist) {
    const reason = report.reason as AnyReason;
    await prisma.$transaction([
      prisma.artwork.update({
        where: { id: art.id },
        data: { status: "REJECTED", flaggedReason: TAKEDOWN_REASON[reason] ?? TAKEDOWN_REASON.other, flaggedBy: admin.id },
      }),
      prisma.artReport.update({ where: { id: report.id }, data: { status: "removed", adminNote: note || null, resolvedAt: now } }),
    ]);
    // Other open reports about the same piece are settled by this takedown.
    const others = await prisma.artReport.findMany({
      where: { artworkId: art.id, status: "open", reason: { not: "counter" }, id: { not: report.id } },
      select: { id: true, name: true, email: true },
    });
    if (others.length) {
      await prisma.artReport.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "removed", resolvedAt: now, adminNote: `Closed with report ${report.id}` } });
    }

    const dispute =
      reason === "copyright"
        ? `If you believe this was a mistake and the work is yours, you can file a counter-notice:\n${SITE_URL}/report?type=counter&art=${art.slug}\n\nHow this works: ${SITE_URL}/dmca\n\nPlease note: accounts with repeated copyright takedowns are closed.`
        : `If you think we got this wrong, reply to us here and tell us more:\n${SITE_URL}/contact`;
    mails.push({
      from: FROM,
      to: artist.email,
      subject: `We took down “${art.title}”`,
      text: `Hi ${artistFirst},\n\nWe removed “${art.title}” from Artfinity after a report.\n\nReason: ${REASON_SHORT[reason] ?? "Other"}${note ? `\nNote from our team: ${note}` : ""}\n\nIt no longer appears on your page and can't be bought. Your other work is not affected.\n\n${dispute}\n\nArtfinity`,
    });
    for (const r of [{ name: report.name, email: report.email }, ...others]) {
      mails.push({
        from: FROM,
        to: r.email,
        subject: "Update on your report: removed",
        text: `Hi ${r.name.split(" ")[0]},\n\nThanks for your report. We reviewed ${title} and took it down.\n\nArtfinity`,
      });
    }
  } else if (action === "restore" && art && artist) {
    await prisma.$transaction([
      prisma.artwork.update({ where: { id: art.id }, data: { status: "APPROVED", flaggedReason: null, flaggedBy: null } }),
      prisma.artReport.update({ where: { id: report.id }, data: { status: "restored", adminNote: note || null, resolvedAt: now } }),
    ]);
    mails.push({
      from: FROM,
      to: report.email,
      subject: `“${art.title}” is back up`,
      text: `Hi ${reporterFirst},\n\nWe've restored “${art.title}” after your counter-notice. It's live and for sale again:\n${artUrl(artist.slug, art.slug!)}\n\nArtfinity`,
    });
  } else {
    // Dismiss. Clear a flag this report put on live art so it leaves the moderation queue.
    await prisma.artReport.update({ where: { id: report.id }, data: { status: "dismissed", adminNote: note || null, resolvedAt: now } });
    if (art?.flaggedBy === `report:${report.id}`) {
      await prisma.artwork.update({ where: { id: art.id }, data: { flaggedReason: null, flaggedBy: null } }).catch(() => null);
    }
    mails.push(
      counter
        ? {
            from: FROM,
            to: report.email,
            subject: "Update on your counter-notice",
            text: `Hi ${reporterFirst},\n\nWe reviewed your counter-notice for ${title} and couldn't accept it as sent.${note ? `\n\n${note}` : ""}\n\nYou can reply to us here: ${SITE_URL}/contact\n\nArtfinity`,
          }
        : {
            from: FROM,
            to: report.email,
            subject: "Update on your report",
            text: `Hi ${reporterFirst},\n\nThanks for your report. We reviewed ${title} and didn't find that it breaks our rules, so it stays up. If you have more information, write to us: ${SITE_URL}/contact\n\nArtfinity`,
          }
    );
  }

  await Promise.all(mails.map((m) => resend.emails.send(m).catch((e) => console.error("report email failed", e))));
  return NextResponse.json({ ok: true });
}
