// POST /api/help/feedback { slug, vote: "up" | "down" } from the "Was this helpful?" box on help articles.
//
// Stored lightly, with no schema change: one Message row per vote on the first admin account,
// direction "help_feedback", email "help:<slug>" (not an address, so no CRM or inbox lists it, the same
// trick as lib/referrals.ts), subject "up" or "down". Counts per article:
//   SELECT email, subject, count(*) FROM "Message" WHERE direction = 'help_feedback' GROUP BY 1, 2;
// Always answers 204 so the button never shows an error.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { getArticle } from "@/content/help";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HELP_FEEDBACK_DIRECTION = "help_feedback";
const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

let adminId: string | null | undefined;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`help-feedback:${ip}`, 20, 60 * 60_000)) return done();

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.slice(0, 80) : "";
  const vote = body?.vote === "up" || body?.vote === "down" ? body.vote : null;
  if (!vote || !getArticle(slug)) return done();

  try {
    if (adminId === undefined) {
      const admin = await prisma.artist.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
      adminId = admin?.id ?? null;
    }
    if (adminId) {
      await prisma.message.create({ data: { artistId: adminId, email: `help:${slug}`, direction: HELP_FEEDBACK_DIRECTION, subject: vote, body: "" } });
    } else {
      console.info("HELP_FEEDBACK", JSON.stringify({ slug, vote }));
    }
  } catch (err) {
    console.error("Help feedback not saved", err);
  }
  return done();
}
