// PUT /api/studio/links/theme { theme } : saves the look of your /@handle/links page.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from "@/lib/auth";
import { themeSchema } from "@/components/links/model";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const { user, denied } = await activeUserGuard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const parsed = themeSchema.strict().safeParse(body?.theme ?? body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue ? `${issue.path.join(".") || "theme"}: ${issue.message}` : "Check the theme.", code: "invalid_input" }, { status: 400 });
  }
  const theme = parsed.data;

  // The background must be one of your own approved pieces.
  if (theme.bgArtworkId) {
    const art = await prisma.artwork.findFirst({ where: { id: theme.bgArtworkId, artistId: user.id, status: "APPROVED" }, select: { id: true } });
    if (!art) return NextResponse.json({ error: "Pick one of your approved pieces for the background.", code: "art_not_found" }, { status: 400 });
  }

  await prisma.artist.update({ where: { id: user.id }, data: { linksTheme: theme } });
  return NextResponse.json({ theme });
}
