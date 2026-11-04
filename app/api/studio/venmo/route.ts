// POST /api/studio/venmo { venmoHandle } : saves (or clears) the signed-in artist's Venmo handle.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let handle: string | null = typeof body.venmoHandle === "string" ? body.venmoHandle.trim() : null;
  if (handle) {
    if (!handle.startsWith("@")) handle = "@" + handle;
    if (!/^@[A-Za-z0-9_-]{1,29}$/.test(handle)) return NextResponse.json({ error: "That Venmo handle looks off." }, { status: 400 });
    const clash = await prisma.artist.findFirst({ where: { venmoHandle: handle, NOT: { id: user.id } }, select: { id: true } });
    if (clash) return NextResponse.json({ error: "That Venmo handle is already in use." }, { status: 400 });
  } else {
    handle = null;
  }

  const artist = await prisma.artist.update({ where: { id: user.id }, data: { venmoHandle: handle }, select: { venmoHandle: true } });
  return NextResponse.json({ artist });
}
