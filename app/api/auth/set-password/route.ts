// POST /api/auth/set-password  { next }
// For accounts made with Google/Apple/Facebook/Instagram that have no password yet: adds one, so email +
// password works too. Accounts that already have a password use /api/auth/change-password (needs the current one).
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
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
  if (!rateLimit(`set-password:${user.id}`, 10)) return NextResponse.json({ code: "rate_limited" }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const next = String(body.next ?? "");
  if (!next) return NextResponse.json({ code: "missing_fields" }, { status: 400 });
  if (next.length < 8) return NextResponse.json({ code: "weak_password" }, { status: 400 });
  if (next.length > 200) return NextResponse.json({ code: "weak_password" }, { status: 400 });

  // Only while there is no password: the conditional update makes this a no-op if one appeared meanwhile.
  const r = await prisma.artist.updateMany({ where: { id: user.id, password: null }, data: { password: await hash(next, 10) } });
  if (r.count !== 1) return NextResponse.json({ code: "has_password" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
