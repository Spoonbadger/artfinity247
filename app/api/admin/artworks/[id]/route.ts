// GET   /api/admin/artworks/:id : one artwork for the admin edit form.
// PATCH /api/admin/artworks/:id { title?, description?, markupSmall?, markupMedium?, markupLarge?, markupXl?, status?, sensitive? }
// Admin-only edit of any artist's artwork. Markups are in cents on top of the base print price.
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { parseSensitive } from "@/components/studio/sensitive";
import { logAdminAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const MARKUPS = ["markupSmall", "markupMedium", "markupLarge", "markupXl"] as const;
const MAX_MARKUP_CENTS = 1_000_000; // $10,000

const SELECT = {
  id: true, title: true, slug: true, description: true, imageUrl: true, status: true, sensitive: true,
  markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true, flaggedReason: true, artistId: true,
  artist: { select: { slug: true, artist_name: true, name: true } },
} as const;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return fail("Forbidden", 403);
  const artwork = await prisma.artwork.findUnique({ where: { id: params.id }, select: SELECT });
  if (!artwork) return fail("Not found", 404);
  return NextResponse.json({ artwork });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return fail("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Nothing to save.");

  const data: Prisma.ArtworkUpdateInput = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) return fail("Title can't be empty.");
    if (title.length > 120) return fail("Keep the title under 120 characters.");
    data.title = title;
  }
  if (body.description !== undefined) {
    const description = String(body.description).trim();
    if (description.length > 2000) return fail("Keep the description under 2,000 characters.");
    data.description = description;
  }
  for (const k of MARKUPS) {
    if (body[k] === undefined) continue;
    const v = Number(body[k]);
    if (!Number.isInteger(v) || v < 0 || v > MAX_MARKUP_CENTS) return fail("Markups must be whole cents between $0 and $10,000.");
    data[k] = v;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return fail("Unknown status.");
    data.status = body.status;
    if (body.status === "APPROVED") {
      data.flaggedReason = null;
      data.flaggedBy = null;
    } else if (body.status === "REJECTED") {
      data.flaggedBy = admin.id;
      data.flaggedReason = "rejected_by_admin";
    }
  }
  if (body.sensitive !== undefined) data.sensitive = parseSensitive(body.sensitive);

  if (!Object.keys(data).length) return fail("Nothing to save.");

  try {
    const artwork = await prisma.artwork.update({ where: { id: params.id }, data, select: SELECT });
    const fields = Object.keys(data).filter((k) => k !== "flaggedReason" && k !== "flaggedBy");
    await logAdminAction(admin, "artwork.edit", { type: "artwork", id: params.id }, `Edited “${artwork.title}”: ${fields.join(", ")}${data.status ? ` (status ${String(data.status)})` : ""}`, { artistId: artwork.artistId, fields, status: data.status ?? undefined });
    return NextResponse.json({ artwork });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("Not found", 404);
    console.error("ADMIN_ARTWORK_EDIT_FAIL", e);
    return fail("Could not save. Try again.", 500);
  }
}
