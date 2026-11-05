// POST /api/reports — public "report this art" form.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { rateLimit } from "@/lib/rateLimit";
import { REASON_SHORT, REPORT_REASONS, SITE_URL } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_TO = process.env.REPORTS_EMAIL || process.env.CONTACT_EMAIL || "contact@theartfinity.com";
const FROM = "Artfinity <notifications@theartfinity.com>";

const Body = z.object({
  art: z.string().trim().max(200).optional().default(""),
  artworkUrl: z.string().trim().max(500).optional().default(""),
  reason: z.enum(REPORT_REASONS, { errorMap: () => ({ message: "Pick what’s wrong." }) }),
  details: z.string().trim().max(5000).optional().default(""),
  name: z.string().trim().min(1, "Add your name.").max(100),
  email: z.string().trim().max(200).email("Add an email we can reply to."),
  isRightsHolder: z.boolean().optional().default(false),
  accurate: z.literal(true, { errorMap: () => ({ message: "Please confirm this is accurate." }) }),
  website: z.string().optional(), // honeypot
});

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Pull a slug out of a pasted artfinity link like https://theartfinity.com/art/blue-ridge
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

  const slug = b.art || slugFromUrl(b.artworkUrl);
  const artwork = slug
    ? await prisma.artwork.findUnique({
        where: { slug },
        select: { id: true, slug: true, title: true, flaggedReason: true, artist: { select: { artist_name: true, name: true } } },
      })
    : null;

  const errors: Record<string, string> = {};
  if (!artwork && !b.artworkUrl) errors.artworkUrl = "Paste a link to the art.";
  if ((b.reason === "copyright" || b.reason === "other") && b.details.length < 10) {
    errors.details = b.reason === "copyright" ? "Tell us where the original is (a link helps)." : "Tell us a little more.";
  }
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  const isRightsHolder = b.reason === "copyright" && b.isRightsHolder;
  const artworkUrl = artwork ? `${SITE_URL}/art/${artwork.slug}` : b.artworkUrl;

  const report = await prisma.artReport.create({
    data: {
      artworkId: artwork?.id ?? null,
      artworkUrl,
      reason: b.reason,
      details: b.details,
      name: b.name,
      email: b.email,
      isRightsHolder,
    },
    select: { id: true },
  });

  // Rights-holder claims stay live but surface in the moderation queue right away.
  if (artwork && isRightsHolder && !artwork.flaggedReason) {
    await prisma.artwork
      .update({ where: { id: artwork.id }, data: { flaggedReason: "Copyright report from rights holder", flaggedBy: `report:${report.id}` } })
      .catch(() => null);
  }

  const what = artwork ? `“${artwork.title}” by ${artwork.artist.artist_name || artwork.artist.name}` : artworkUrl;
  const reasonText = REASON_SHORT[b.reason];

  await Promise.all([
    resend.emails
      .send({
        from: FROM,
        to: ADMIN_TO,
        replyTo: b.email,
        subject: `Art report (${reasonText}): ${artwork?.title ?? "link"}`,
        text: `${b.name} <${b.email}>${isRightsHolder ? " · says they are the rights holder" : ""}\n\nArt: ${what}\n${artworkUrl}\nReason: ${reasonText}\n\n${b.details || "(no details)"}\n\nReview: ${SITE_URL}/admin/reports`,
        html: `<p><b>${esc(b.name)}</b> &lt;${esc(b.email)}&gt;${isRightsHolder ? " · says they are the rights holder" : ""}</p><p>Art: <a href="${esc(artworkUrl)}">${esc(what)}</a><br>Reason: ${esc(reasonText)}</p><p style="white-space:pre-wrap">${esc(b.details || "(no details)")}</p><p><a href="${SITE_URL}/admin/reports">Review in admin</a></p>`,
      })
      .catch((e) => console.error("report admin email failed", e)),
    resend.emails
      .send({
        from: FROM,
        to: b.email,
        subject: "We got your report",
        text: `Hi ${b.name.split(" ")[0]},\n\nThanks for telling us about ${what}. A person on our team will review it within 2 business days. If it's infringing, we take it down, and we'll email you either way.\n\nArtfinity`,
      })
      .catch((e) => console.error("report confirmation email failed", e)),
  ]);

  return NextResponse.json({ ok: true, id: report.id });
}
