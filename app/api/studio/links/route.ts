// GET  /api/studio/links : the signed-in artist's links (with click counts) and link-page theme.
// POST /api/studio/links { url, label?, display?: "icon"|"button", kind? } : adds a link at the end.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { LINK_SELECT, MAX_LINKS, linkInput, normalizeUrl, readTheme, resolveKind } from "@/components/links/model";

export const dynamic = "force-dynamic";


export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const [links, artist] = await Promise.all([
    prisma.artistLink.findMany({ where: { artistId: user.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: LINK_SELECT }),
    prisma.artist.findUnique({ where: { id: user.id }, select: { linksTheme: true } }),
  ]);
  return NextResponse.json({ links, theme: readTheme(artist?.linksTheme) });
}

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });

  const parsed = linkInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the link and label." }, { status: 400 });
  const norm = normalizeUrl(parsed.data.url);
  if ("error" in norm) return NextResponse.json({ error: norm.error }, { status: 400 });

  const kind = resolveKind(norm.url, parsed.data.display, parsed.data.kind);
  const label = parsed.data.label?.trim() || null;
  if (kind === "custom" && !label) return NextResponse.json({ error: "Give the button a label." }, { status: 400 });

  const count = await prisma.artistLink.count({ where: { artistId: user.id } });
  if (count >= MAX_LINKS) return NextResponse.json({ error: `Up to ${MAX_LINKS} links.` }, { status: 400 });
  const last = await prisma.artistLink.aggregate({ where: { artistId: user.id }, _max: { position: true } });

  const link = await prisma.artistLink.create({
    data: { artistId: user.id, kind, label, url: norm.url, position: (last._max.position ?? -1) + 1, active: parsed.data.active ?? true },
    select: LINK_SELECT,
  });
  return NextResponse.json({ link }, { status: 201 });
}
