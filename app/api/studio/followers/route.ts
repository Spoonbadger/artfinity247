// GET  /api/studio/followers → CSV of the artist's followers.
// POST /api/studio/followers { text, consent: true } → imports emails as confirmed followers (source "import").
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { emailSchema, newToken } from "@/lib/followers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_IMPORT = 1000;

async function artistId() {
  const user = await getUserFromCookie();
  if (!user?.id) return null;
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, slug: true, closedAt: true } });
  return a && !a.closedAt ? a : null;
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const statusOf = (f: { confirmedAt: Date | null; unsubscribedAt: Date | null }) => (f.unsubscribedAt ? "unsubscribed" : f.confirmedAt ? "confirmed" : "pending");

export async function GET() {
  const artist = await artistId();
  if (!artist) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const rows = await prisma.follower.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" } });
  const lines = [
    "email,name,status,source,followed_at,confirmed_at,unsubscribed_at",
    ...rows.map((f) =>
      [f.email, f.name ?? "", statusOf(f), f.source, f.createdAt.toISOString(), f.confirmedAt?.toISOString() ?? "", f.unsubscribedAt?.toISOString() ?? ""].map(csvCell).join(","),
    ),
  ];
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="followers-${artist.slug ?? "artfinity"}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

const Body = z.object({ text: z.string().max(200_000), consent: z.literal(true) });

/** "Ada Lovelace <ada@x.com>", "ada@x.com, Ada", one per line or comma-separated. */
function parseList(text: string) {
  const found = new Map<string, string | null>();
  for (const line of text.split(/[\n;]+/)) {
    const emails = line.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/g) || [];
    const rest = line.replace(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/g, "").replace(/[<>",;]/g, " ").trim().replace(/\s+/g, " ");
    for (const e of emails) {
      const ok = emailSchema.safeParse(e);
      if (ok.success && !found.has(ok.data)) found.set(ok.data, emails.length === 1 && rest ? rest.slice(0, 80) : null);
    }
  }
  return found;
}

export async function POST(req: Request) {
  const artist = await artistId();
  if (!artist) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (!rateLimit(`import:${artist.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "Too many imports. Try again later." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tick the box to confirm these people agreed to hear from you." }, { status: 400 });
  const list = parseList(parsed.data.text);
  if (!list.size) return NextResponse.json({ error: "No email addresses found." }, { status: 400 });
  if (list.size > MAX_IMPORT) return NextResponse.json({ error: `Up to ${MAX_IMPORT} at a time.` }, { status: 400 });

  // Existing rows are left alone: an import never resubscribes someone who unsubscribed.
  const existing = await prisma.follower.findMany({ where: { artistId: artist.id, email: { in: Array.from(list.keys()) } }, select: { email: true } });
  const skip = new Set(existing.map((e) => e.email));
  const now = new Date();
  const data = Array.from(list.entries())
    .filter(([email]) => !skip.has(email))
    .map(([email, name]) => ({ artistId: artist.id, email, name, source: "import", token: newToken(), confirmedAt: now }));
  const r = await prisma.follower.createMany({ data, skipDuplicates: true });
  return NextResponse.json({ ok: true, added: r.count, skipped: list.size - r.count });
}
