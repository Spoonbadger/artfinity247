// POST /api/reports — public "report this art" form, DMCA notices and counter-notices.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { rateLimit } from "@/lib/rateLimit";
import { artUrl } from "@/lib/urls";
import { getUserFromCookie } from "@/lib/auth";
import { raiseAlert } from "@/lib/alerts";
import { reportAlert } from "@/lib/alertBuilders";
import { DMCA_STATEMENTS, REASON_SHORT, REPORT_REASONS, SITE_URL, earliestRestore, type DmcaCounter, type DmcaNotice } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_TO = process.env.REPORTS_EMAIL || process.env.CONTACT_EMAIL || "contact@theartfinity.com";
const FROM = "Artfinity <notifications@theartfinity.com>";

const str = (max: number) => z.string().trim().max(max).optional().default("");
const flag = z.boolean().optional().default(false);
const Body = z.object({
  art: str(200),
  artworkUrl: str(500),
  reason: z.enum([...REPORT_REASONS, "counter"]).optional().catch(undefined),
  details: str(5000),
  original: str(2000),
  name: str(100),
  email: str(200),
  address: str(300),
  phone: str(40),
  signature: str(100),
  accurate: flag,
  goodFaith: flag,
  perjury: flag,
  mistake: flag,
  jurisdiction: flag,
  website: z.string().optional(), // honeypot
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

// Pull a slug out of a pasted artfinity link like https://theartfinity.com/@maya/art/east-river (or the old /art/east-river)
function slugFromUrl(u: string) {
  const m = u.match(/\/art\/([^/?#\s]+)/i);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  // 5 reports per IP per 10 minutes.
  if (!rateLimit(`report:${ip}`, 5, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many reports from here. Try again in a few minutes." }, { status: 429 });
  }

  const raw = await req.json().catch(() => null);
  if (raw?.website) return NextResponse.json({ ok: true }); // bots

  const parsed = Body.safeParse(raw ?? {});
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }
  const b = parsed.data;
  const dmca = b.reason === "copyright";
  const counter = b.reason === "counter";

  const slug = b.art || slugFromUrl(b.artworkUrl);
  const artwork = slug
    ? await prisma.artwork.findUnique({
        where: { slug },
        select: {
          id: true, slug: true, title: true, status: true, flaggedReason: true, artistId: true,
          artist: { select: { slug: true, artist_name: true, name: true, email: true } },
        },
      })
    : null;

  // Field checks run together so the form can show every problem at once.
  const errors: Record<string, string> = {};
  if (!b.reason) errors.reason = "Pick what’s wrong.";
  if (!b.name) errors.name = "Add your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) errors.email = "Add an email we can reply to.";
  if (counter) {
    // Counter-notices come from the artist's own account.
    const user = await getUserFromCookie();
    if (!artwork) return NextResponse.json({ ok: false, error: "We couldn’t find that work." }, { status: 404 });
    if (!user || (user.id !== artwork.artistId && user.role !== "ADMIN")) {
      return NextResponse.json({ ok: false, error: "Log in to the artist’s account to file a counter-notice." }, { status: 403 });
    }
    if (b.details.length < 10) errors.details = "Tell us what was removed and why it’s yours.";
    if (!b.mistake) errors.mistake = "Required for a counter-notice.";
    if (!b.jurisdiction) errors.jurisdiction = "Required for a counter-notice.";
  } else {
    if (!artwork && !b.artworkUrl) errors.artworkUrl = "Paste a link to the art.";
    if (b.reason === "other" && b.details.length < 10) errors.details = "Tell us a little more.";
    if (dmca) {
      if (b.original.length < 4) errors.original = "Link to or describe your original work.";
      if (!b.goodFaith) errors.goodFaith = "Required for a copyright notice.";
      if (!b.perjury) errors.perjury = "Required for a copyright notice.";
    } else if (!b.accurate) {
      errors.accurate = "Please confirm this is accurate.";
    }
  }
  if (dmca || counter) {
    if (b.address.length < 8) errors.address = "Add your full mailing address.";
    // Only a counter-notice needs a phone (17 U.S.C. 512(g)(3)(D)); a takedown notice is reached by email.
    if (counter && b.phone.replace(/\D/g, "").length < 7) errors.phone = "Add a phone number.";
    if (b.signature.length < 2) errors.signature = "Type your full name to sign.";
  }
  if (Object.keys(errors).length || !b.reason) return NextResponse.json({ ok: false, errors }, { status: 422 });
  const reason = b.reason;

  const artworkUrl = artwork ? artUrl(artwork.artist.slug, artwork.slug!) : b.artworkUrl;
  const signedAt = new Date().toISOString();

  // Signed notices keep every statutory field as JSON in `details`.
  let details = b.details;
  if (dmca) {
    const n: DmcaNotice = {
      kind: "dmca-notice", original: b.original, infringingUrl: artworkUrl, address: b.address, phone: b.phone, notes: b.details,
      statements: [DMCA_STATEMENTS.goodFaith, DMCA_STATEMENTS.perjury], signature: b.signature, signedAt,
    };
    details = JSON.stringify(n);
  } else if (counter) {
    const c: DmcaCounter = {
      kind: "dmca-counter", removedWork: b.details, removedUrl: artworkUrl, address: b.address, phone: b.phone,
      statements: [DMCA_STATEMENTS.mistake, DMCA_STATEMENTS.jurisdiction], signature: b.signature, signedAt,
    };
    details = JSON.stringify(c);
  }

  const report = await prisma.artReport.create({
    data: {
      artworkId: artwork?.id ?? null,
      artworkUrl,
      reason,
      details,
      name: b.name,
      email: b.email,
      isRightsHolder: dmca, // the perjury statement covers "owner or authorized"
    },
    select: { id: true, createdAt: true },
  });

  // Admin alert: DMCA notices and counter-notices are urgent (emailed right away), other reports go in the digest.
  await raiseAlert(reportAlert({ id: report.id, reason, artworkUrl, artwork }));

  // DMCA notices keep the art live but put it in the moderation queue right away.
  if (artwork && dmca && artwork.status === "APPROVED" && !artwork.flaggedReason) {
    await prisma.artwork
      .update({ where: { id: artwork.id }, data: { flaggedReason: "DMCA notice received", flaggedBy: `report:${report.id}` } })
      .catch(() => null);
  }

  const artistName = artwork ? artwork.artist.artist_name || artwork.artist.name : "";
  const what = artwork ? `“${artwork.title}” by ${artistName}` : artworkUrl;
  const reasonText = REASON_SHORT[reason];
  const first = b.name.split(" ")[0];
  const legalLines = dmca
    ? `Original work: ${b.original}\nAddress: ${b.address}\nSigned: ${b.signature}\n`
    : counter
      ? `Removed work: ${b.details}\nAddress: ${b.address}\nPhone: ${b.phone}\nSigned: ${b.signature}\n`
      : "";
  const sends: Promise<unknown>[] = [
    resend.emails.send({
      from: FROM,
      to: ADMIN_TO,
      replyTo: b.email,
      subject: `${counter ? "DMCA counter-notice" : dmca ? "DMCA notice" : `Art report (${reasonText})`}: ${artwork?.title ?? "link"}`,
      text: `${b.name} <${b.email}>\n\nArt: ${what}\n${artworkUrl}\nReason: ${reasonText}\n${legalLines}\n${counter ? "" : b.details || "(no details)"}\n\nReview: ${SITE_URL}/admin/reports`,
      html: `<p><b>${esc(b.name)}</b> &lt;${esc(b.email)}&gt;</p><p>Art: <a href="${esc(artworkUrl)}">${esc(what)}</a><br>Reason: ${esc(reasonText)}</p><p style="white-space:pre-wrap">${esc(legalLines)}${esc(counter ? "" : b.details || "(no details)")}</p><p><a href="${SITE_URL}/admin/reports">Review in admin</a></p>`,
    }),
  ];

  if (counter && artwork) {
    const restore = fmtDay(earliestRestore(report.createdAt));
    const latest = fmtDay(earliestRestore(report.createdAt, 14));
    sends.push(
      resend.emails.send({
        from: FROM,
        to: b.email,
        subject: "We got your counter-notice",
        text: `Hi ${first},\n\nWe received your counter-notice for “${artwork.title}”. We'll send a copy to the person who filed the copyright notice. If they don't tell us they've filed a court action, we'll put your work back up between ${restore} and ${latest}.\n\nArtfinity`,
      })
    );
    // 512(g)(2)(B): send the complainant a copy and the restore date.
    const notice = await prisma.artReport.findFirst({
      where: { artworkId: artwork.id, reason: "copyright", status: "removed" },
      orderBy: { resolvedAt: "desc" },
      select: { email: true, name: true },
    });
    if (notice) {
      sends.push(
        resend.emails.send({
          from: FROM,
          to: notice.email,
          replyTo: ADMIN_TO,
          subject: `Counter-notice for “${artwork.title}”`,
          text: `Hi ${notice.name.split(" ")[0]},\n\nThe artist has filed a counter-notice for the work you reported (${artworkUrl}). A copy is below.\n\nWe will restore the work on or after ${restore} unless you tell us, by replying to this email, that you have filed a court action seeking to stop the infringement.\n\n---\nName: ${b.name}\nEmail: ${b.email}\nAddress: ${b.address}\nPhone: ${b.phone}\nRemoved work: ${b.details}\n\n${DMCA_STATEMENTS.mistake}\n${DMCA_STATEMENTS.jurisdiction}\n\nSigned: ${b.signature}, ${signedAt.slice(0, 10)}\n---\n\nArtfinity`,
        })
      );
    }
  } else {
    sends.push(
      resend.emails.send({
        from: FROM,
        to: b.email,
        subject: dmca ? "We got your copyright notice" : "We got your report",
        text: `Hi ${first},\n\nThanks for telling us about ${what}. A person on our team will review it within 2 business days. If it's infringing, we take it down, and we'll email you either way.\n\nArtfinity`,
      })
    );
  }

  await Promise.all(sends.map((p) => p.catch((e) => console.error("report email failed", e))));
  return NextResponse.json({ ok: true, id: report.id });
}
