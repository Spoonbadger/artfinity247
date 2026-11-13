// The real piece and real numbers behind the home hero and /how-it-works, so both pages tell the same story.
import { prisma } from "@/lib/prisma";
import { breakdown, type SizeKey } from "@/lib/earnings";
import { displayName, PUBLIC_ART } from "@/components/browse/data";
import type { HeroArt } from "./HeroStory";

const select = {
  artistId: true, slug: true, title: true, imageUrl: true, sensitive: true,
  markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
  artist: { select: { name: true, artist_name: true, slug: true } },
} as const;

async function getHeroArt() {
  const live = { ...PUBLIC_ART, status: "APPROVED" as const, sensitive: { isEmpty: true } };
  // A different live, safe-for-work piece on each visit. Picked on the server, so the first paint already has it
  // (no swap, no layout shift) and it costs one count plus one indexed row.
  const n = await prisma.artwork.count({ where: live });
  const random = n ? await prisma.artwork.findFirst({ where: live, orderBy: { id: "asc" }, skip: Math.floor(Math.random() * n), select }) : null;
  // Fallback, as before: the best-selling safe piece, then the newest public one.
  return (
    random ??
    (await prisma.artwork.findFirst({ where: live, orderBy: [{ OrderItem: { _count: "desc" } }, { createdAt: "asc" }], select })) ??
    (await prisma.artwork.findFirst({ where: PUBLIC_ART, orderBy: { createdAt: "desc" }, select }))
  );
}

/** Prints the hero artist sold in the last 30 days, for the earnings chip. */
async function printsThisMonth(artistId: string) {
  const since = new Date(Date.now() - 30 * 864e5);
  const r = await prisma.orderItem.aggregate({ _sum: { quantity: true }, where: { artwork: { artistId }, order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: since } } } });
  return r._sum.quantity ?? 0;
}

export async function getHeroData() {
  const hero = await getHeroArt();
  const markup: Record<SizeKey, number> = {
    small: hero?.markupSmall ?? (hero ? 0 : 1000),
    medium: hero?.markupMedium ?? (hero ? 0 : 1500),
    large: hero?.markupLarge ?? 0,
    xl: hero?.markupXl ?? 0,
  };
  const perPrint = breakdown("medium", markup.medium).artist;
  const smallPerPrint = breakdown("small", markup.small).artist;
  const price = breakdown("medium", markup.medium).price;
  const monthBefore = hero ? Math.max(1, await printsThisMonth(hero.artistId)) * perPrint : 0;
  const heroArt: HeroArt | null = hero
    ? { slug: hero.slug!, title: hero.title, imageUrl: hero.imageUrl, sensitive: hero.sensitive, artist: { name: displayName(hero.artist), slug: hero.artist.slug } }
    : null;
  return { heroArt, markup, perPrint, smallPerPrint, price, monthBefore };
}
