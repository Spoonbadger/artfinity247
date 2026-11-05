// POST /api/auth/change-password  { current, next }
// Changes the signed-in artist's password after checking the current one.
import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ code: "not_logged_in" }, { status: 401 });
  }

  // Keyed per artist (and per IP) so guessing the current password is slow.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`change-password:${user.id}`) || !rateLimit(`change-password-ip:${ip}`)) {
    return NextResponse.json({ code: "rate_limited" }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  if (!current || !next) return NextResponse.json({ code: "missing_fields" }, { status: 400 });
  if (next.length < 8) return NextResponse.json({ code: "weak_password" }, { status: 400 });

  const artist = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, password: true } });
  if (!artist) return NextResponse.json({ code: "not_logged_in" }, { status: 401 });
  if (!artist.password || !(await compare(current, artist.password))) return NextResponse.json({ code: "bad_password" }, { status: 400 });

  await prisma.artist.update({ where: { id: artist.id }, data: { password: await hash(next, 10) } });
  return NextResponse.json({ ok: true });
}
