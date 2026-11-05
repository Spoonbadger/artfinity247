// GET/PUT /api/studio/design  — the signed-in artist's page design (Artist.pageTheme).
// PUT { theme } is validated strictly: palette colors only, banner and pins must be the artist's own approved work.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { parseTheme, themeError, type PageTheme } from "@/components/artist/theme";

export const dynamic = "force-dynamic";

async function ownedIds(artistId: string) {
  const rows = await prisma.artwork.findMany({ where: { artistId, status: "APPROVED" }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select: { pageTheme: true } });
  if (!a) return NextResponse.json({ error: "Artist not found.", code: "not_logged_in" }, { status: 404 });
  return NextResponse.json({ theme: parseTheme(a.pageTheme, await ownedIds(user.id)) });
}

export async function PUT(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { theme?: unknown } | null;
  const ids = await ownedIds(user.id);
  const err = themeError(body?.theme, ids);
  if (err) return NextResponse.json({ error: err, code: "invalid_input" }, { status: 400 });

  // Rebuild from the parsed value so only known keys are stored.
  const theme: PageTheme = parseTheme(body!.theme, ids);
  await prisma.artist.update({ where: { id: user.id }, data: { pageTheme: theme } });
  return NextResponse.json({ theme });
}
