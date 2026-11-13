// GET /api/artworks/price-guide : what similar work sells at, per print size, for the upload form.
// The middle 50% (25th–75th percentile) of live prices (base + markup) on other artists' approved work,
// counting a piece for a size only when its file prints that size. Sizes with fewer than 8 pieces get null.
// One SQL round trip; Postgres does the percentiles.
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { basePrices } from "@/lib/artwork_price";

export const dynamic = "force-dynamic";

const MIN_POINTS = 8;
const COLS = { small: "markupSmall", medium: "markupMedium", large: "markupLarge", xl: "markupXl" } as const;
type Size = keyof typeof COLS;
export type PriceGuide = Record<Size, { lo: number; hi: number; n: number } | null>;

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parts = (Object.keys(COLS) as Size[]).map((s) => {
    const col = Prisma.raw(`COALESCE("${COLS[s]}", 0)`);
    return Prisma.sql`
      SELECT ${s}::text AS size, count(*)::int AS n,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY ${col})::float AS lo,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY ${col})::float AS hi
      FROM "Artwork"
      WHERE status = 'APPROVED' AND "artistId" <> ${user.id}
        AND (cardinality("printableSizes") = 0 OR ${s}::text = ANY("printableSizes"))`;
  });
  const rows = await prisma.$queryRaw<{ size: Size; n: number; lo: number | null; hi: number | null }[]>(Prisma.join(parts, " UNION ALL "));

  const out = { small: null, medium: null, large: null, xl: null } as PriceGuide;
  for (const r of rows) {
    if (r.n < MIN_POINTS || r.lo == null || r.hi == null) continue;
    // Whole dollars, widened outward so the range never reads tighter than the data.
    out[r.size] = {
      lo: Math.floor((basePrices[r.size] + r.lo) / 100) * 100,
      hi: Math.ceil((basePrices[r.size] + r.hi) / 100) * 100,
      n: r.n,
    };
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "private, max-age=600" } });
}
