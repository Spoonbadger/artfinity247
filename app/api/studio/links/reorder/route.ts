// POST /api/studio/links/reorder { ids: string[] } : saves the order of your links (first id = top).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const parsed = z.object({ ids: z.array(z.string().max(40)).max(100) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Couldn't save that order. Refresh the page and try again.", code: "invalid_input" }, { status: 400 });

  const mine = await prisma.artistLink.findMany({ where: { artistId: user.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const known = new Set(mine.map((l) => l.id));
  const ids = Array.from(new Set(parsed.data.ids.filter((id) => known.has(id))));
  // Anything the client left out keeps its relative order at the end.
  for (const l of mine) if (!ids.includes(l.id)) ids.push(l.id);

  await prisma.$transaction(ids.map((id, position) => prisma.artistLink.update({ where: { id }, data: { position } })));
  return NextResponse.json({ ids });
}
