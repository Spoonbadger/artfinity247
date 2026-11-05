// POST /api/collector/sign-in { email, save?: artworkId, next?: path, website(honeypot) } → { ok, message }
// Emails a one-time sign-in link (lib/collector.ts). Always answers the same way, so it never says whether an email has orders.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { collectorEmailSchema, knownBuyer, safeNext, sendSignInLink } from "@/lib/collector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  email: collectorEmailSchema,
  save: z.string().trim().min(1).max(40).optional().nullable(),
  next: z.string().max(300).optional().nullable(),
  website: z.string().optional(), // honeypot
});

const SENT = "If there are orders for this email, we sent a link. It works once, for 15 minutes.";
const SAVED = "Check your email. Tap the link and it's saved to your collection.";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`collector-signin:${ip}`, 8, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many tries. Give it a few minutes." }, { status: 429 });
  }
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const emailBad = parsed.error.issues.some((i) => i.path[0] === "email");
    return NextResponse.json({ error: emailBad ? "That email doesn't look right." : "Bad request." }, { status: 400 });
  }
  const { email, save, next, website } = parsed.data;
  const message = save ? SAVED : SENT;
  // Bots fill the hidden field: pretend it worked.
  if (website?.trim()) return NextResponse.json({ ok: true, message });
  // Same address: at most 3 links per 15 minutes (quietly, same answer).
  if (!rateLimit(`collector-signin-mail:${email}`, 3, 15 * 60_000)) return NextResponse.json({ ok: true, message });

  try {
    if (save) {
      // Saving a piece starts a collection for anyone, so this always sends (and says nothing about orders).
      const art = await prisma.artwork.findFirst({ where: { id: save, status: "APPROVED" }, select: { id: true, title: true } });
      if (!art) return NextResponse.json({ error: "That piece isn't available." }, { status: 404 });
      await sendSignInLink(email, { save: art, next: safeNext(next, "/collector") });
    } else if (await knownBuyer(email)) {
      await sendSignInLink(email, { next: safeNext(next, "/collector") });
    }
  } catch (err) {
    console.error("[collector] sign-in email failed", err);
    return NextResponse.json({ error: "Couldn't send the email. Try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message });
}
