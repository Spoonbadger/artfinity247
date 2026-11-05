// POST /api/follow { handle, email, source?, website(honeypot) } → { state: "pending" | "following" }
// Sends a double opt-in email; the link (/follow/confirm?t=) confirms.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { emailSchema, requestFollow } from "@/lib/followers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  handle: z.string().trim().min(1).max(80),
  email: emailSchema,
  source: z.enum(["page", "links"]).default("page"),
  website: z.string().optional(), // honeypot
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`follow:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many tries. Give it a few minutes." }, { status: 429 });
  }

  const raw = await req.json().catch(() => null);
  // Bots fill the hidden field: pretend it worked.
  if (raw && typeof raw.website === "string" && raw.website.trim()) return NextResponse.json({ state: "pending" });

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const emailBad = parsed.error.issues.some((i) => i.path[0] === "email");
    return NextResponse.json({ error: emailBad ? "That email doesn't look right." : "Bad request." }, { status: 400 });
  }
  const { handle, email, source } = parsed.data;

  // Same address + artist: at most 3 confirm emails an hour.
  if (!rateLimit(`follow-mail:${handle.toLowerCase()}:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json({ state: "pending" });
  }

  const artist = await prisma.artist.findFirst({
    where: { slug: { equals: handle, mode: "insensitive" }, closedAt: null },
    select: { id: true },
  });
  if (!artist) return NextResponse.json({ error: "Artist not found." }, { status: 404 });

  const me = await getUserFromCookie();
  try {
    const state = await requestFollow({ artistId: artist.id, email, source, viewerEmail: me?.email ?? null });
    return NextResponse.json({ state });
  } catch (err) {
    console.error("[follow] failed", err);
    return NextResponse.json({ error: "Couldn't send the email. Try again in a moment." }, { status: 500 });
  }
}
