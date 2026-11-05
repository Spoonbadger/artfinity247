// PATCH  /api/studio/links/:id { url?, label?, active?, display?, kind? } : edits one of your links.
// DELETE /api/studio/links/:id : removes it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { LINK_SELECT, linkInput, normalizeUrl, resolveKind } from "@/components/links/model";

export const dynamic = "force-dynamic";

async function own(id: string) {
  const user = await getUserFromCookie();
  if (!user?.id) return { error: NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 }) };
  const link = await prisma.artistLink.findFirst({ where: { id, artistId: user.id }, select: LINK_SELECT });
  if (!link) return { error: NextResponse.json({ error: "That link is gone. Refresh the page.", code: "not_found" }, { status: 404 }) };
  return { link };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const found = await own(params.id);
  if ("error" in found) return found.error;
  const parsed = linkInput.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Check the link and label.", code: "invalid_input" }, { status: 400 });
  const body = parsed.data;

  let url = found.link.url;
  if (body.url !== undefined) {
    const norm = normalizeUrl(body.url);
    if ("error" in norm) return NextResponse.json({ error: norm.error, code: "invalid_url" }, { status: 400 });
    url = norm.url;
  }
  const kind = body.url !== undefined || body.display || body.kind ? resolveKind(url, body.display, body.kind ?? (body.display ? undefined : found.link.kind)) : found.link.kind;
  const label = body.label !== undefined ? body.label?.trim() || null : found.link.label;
  if (kind === "custom" && !label) return NextResponse.json({ error: "Give the button a label.", code: "missing_label" }, { status: 400 });

  const link = await prisma.artistLink.update({
    where: { id: found.link.id },
    data: { url, kind, label, ...(body.active !== undefined ? { active: body.active } : {}) },
    select: LINK_SELECT,
  });
  return NextResponse.json({ link });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const found = await own(params.id);
  if ("error" in found) return found.error;
  await prisma.artistLink.delete({ where: { id: found.link.id } });
  return NextResponse.json({ ok: true });
}
