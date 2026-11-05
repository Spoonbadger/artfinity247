// Server-only data helpers for the artist Studio.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue";

export const SIZE_LABEL: Record<PrintSize, string> = { S: "Small", M: "Medium", L: "Large", XL: "XL" };

/** OrderItem.size is "S" | "M" | "L" | "XL" today; older rows may say "small" etc. */
export function toPrintSize(size: string | null | undefined): PrintSize {
  const s = String(size || "").trim().toLowerCase();
  if (s === "s" || s === "small") return "S";
  if (s === "l" || s === "large") return "L";
  if (s === "xl" || s === "x-large" || s === "xlarge") return "XL";
  return "M";
}

/** Path of the current request, for ?next= on the login redirect. */
export function currentPath(fallback = "/studio") {
  const h = headers();
  const p = h.get("x-af-path") || h.get("x-invoke-path") || h.get("next-url");
  return p && p.startsWith("/studio") ? p : fallback;
}

/** Signed-in artist, or a redirect to the login page. */
export async function requireArtist(nextPath?: string) {
  const user = await getUserFromCookie();
  // The middleware header has the exact path and query; nextPath is the fallback.
  const next = currentPath(nextPath || "/studio");
  if (!user?.id) redirect(`/login?next=${encodeURIComponent(next)}`);
  const artist = await prisma.artist.findUnique({
    where: { id: user.id },
    select: {
      id: true, slug: true, name: true, first_name: true, artist_name: true, city: true,
      profileImage: true, bio: true, venmoHandle: true, email: true, role: true, closedAt: true,
    },
  });
  if (!artist) redirect(`/login?next=${encodeURIComponent(next)}`);
  // A closed account's old cookie no longer opens the Studio.
  if (artist.closedAt) redirect("/login?closed=1");
  return artist;
}

export type StudioArtist = Awaited<ReturnType<typeof requireArtist>>;

export function displayName(a: { artist_name?: string | null; name?: string | null }) {
  return a.artist_name || a.name || "Artist";
}

export function firstName(a: { first_name?: string | null; artist_name?: string | null; name?: string | null }) {
  return a.first_name || displayName(a).split(" ")[0];
}

export type Sale = {
  id: string;
  date: Date;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  size: PrintSize;
  framed: boolean;
  quantity: number;
  priceCents: number;
  shareCents: number;
  split: number;
};

/** Paid order items for the artist's artworks, newest first. */
export async function getSales(artistId: string, since?: Date): Promise<Sale[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      artwork: { artistId },
      order: { paymentStatus: "paid", kind: { not: "bulk" }, ...(since ? { createdAt: { gte: since } } : {}) },
    },
    select: {
      id: true, title: true, slug: true, size: true, frameChosen: true, quantity: true,
      unitPrice: true, lineTotal: true, imageUrl: true, artistSplit: true,
      artwork: { select: { title: true, slug: true, imageUrl: true } },
      order: { select: { createdAt: true } },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  return items.map((it) => {
    const quantity = it.quantity ?? 1;
    const priceCents = it.lineTotal ?? (it.unitPrice ?? 0) * quantity;
    const size = toPrintSize(it.size);
    const date = it.order.createdAt;
    // Prefer the split locked in at order time (Infinity orders store a higher one).
    const { artistShare, split } = calcItemProfitCents({ lineTotal: priceCents, size, frameChosen: it.frameChosen, quantity, orderDate: date, artistSplit: it.artistSplit });
    return {
      id: it.id,
      date,
      title: it.artwork?.title || it.title || "Untitled",
      slug: it.artwork?.slug || it.slug,
      imageUrl: it.artwork?.imageUrl || it.imageUrl,
      size,
      framed: it.frameChosen,
      quantity,
      priceCents,
      shareCents: artistShare,
      split,
    };
  });
}

export async function getArtworks(artistId: string) {
  return prisma.artwork.findMany({
    where: { artistId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, imageUrl: true, status: true, sensitive: true, createdAt: true,
      markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
      _count: { select: { OrderItem: true } },
    },
  });
}

export type StudioArtwork = Awaited<ReturnType<typeof getArtworks>>[number];

export function timeAgo(d: Date, now = new Date()) {
  const s = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const days = Math.round(s / 86400);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const STUDIO_TZ = "America/New_York";

/** YYYY-MM-DD in the Studio time zone. */
export function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: STUDIO_TZ });
}

/** Server-side guess at the greeting; the client corrects it to the viewer's clock. */
export function serverGreeting(now = new Date()) {
  const h = Number(now.toLocaleString("en-US", { timeZone: STUDIO_TZ, hour: "numeric", hourCycle: "h23" }));
  if (h < 5 || h >= 17) return "Good evening";
  return h < 12 ? "Good morning" : "Good afternoon";
}

/** Dollars with cents and thousands separators: 190973 -> "$1,909.73". */
export const usd = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
