import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BrushStroke, Brushed } from "@/components/af/Brush";
import { PUBLIC_ART, displayName } from "@/components/browse/data";
import { basePrices } from "@/lib/artwork_price";
import SalonStrip from "@/components/home/SalonStrip";
import BrushWipe from "@/components/motion/BrushWipe";
import { Dabs } from "@/components/reviews/ReviewStars";
import { breakdown, money, moneyRound } from "@/lib/earnings";
import { itemBreakdown } from "@/lib/sales";
import { getArtistSplit } from "@/lib/revenue";
import { PRO } from "@/lib/plans";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";
import { COMPANY, STORY, TEAM } from "@/lib/about";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "About",
  description: "Who we are: Artfinity prints and ships art for independent artists, and sends most of the profit to them.",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

async function getStats() {
  const liveArtist = { role: "USER" as const, closedAt: null, suspendedAt: null, artworks: { some: { status: "APPROVED" as const } } };
  const [artists, cities, items, reviews] = await Promise.all([
    prisma.artist.count({ where: liveArtist }),
    prisma.artist.findMany({ where: { ...liveArtist, citySlug: { not: "" } }, distinct: ["citySlug"], select: { citySlug: true } }),
    prisma.orderItem.findMany({
      where: { order: { kind: "retail", paymentStatus: "paid" } },
      select: { lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, order: { select: { createdAt: true } } },
    }),
    prisma.review.aggregate({ where: { status: "published" }, _avg: { rating: true }, _count: true }),
  ]);
  let prints = 0;
  let earned = 0;
  for (const i of items) {
    const b = itemBreakdown({ ...i, orderDate: i.order.createdAt });
    prints += b.quantity;
    earned += b.artistShare;
  }
  return { artists, cities: cities.length, prints, earned, rating: reviews._avg.rating ?? 0, reviewCount: reviews._count };
}

export default async function AboutPage() {
  const [art, stats] = await Promise.all([
    prisma.artwork.findMany({
      where: { ...PUBLIC_ART, status: "APPROVED", sensitive: { isEmpty: true } },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { slug: true, title: true, imageUrl: true, artistId: true, markupSmall: true, artist: { select: { slug: true, name: true, artist_name: true } } },
    }),
    getStats(),
  ]);
  // one piece per artist first, so the wall shows range
  const seen = new Set<string>();
  const wall = [...art.filter((a) => !seen.has(a.artistId) && seen.add(a.artistId)), ...art].filter((a, i, all) => all.findIndex((b) => b.slug === a.slug) === i)
    .map((a) => ({ slug: a.slug!, handle: a.artist.slug, title: a.title, imageUrl: a.imageUrl, artist: displayName(a.artist), priceFrom: basePrices.small + (a.markupSmall ?? 0) }));
  const half = Math.ceil(wall.length / 2);

  const split = getArtistSplit(new Date());
  const example = breakdown("medium", 1500); // a Medium print with a $15 markup

  const numbers: [string, string][] = [
    [stats.artists.toLocaleString("en-US"), stats.artists === 1 ? "artist" : "artists"],
    [stats.cities.toLocaleString("en-US"), stats.cities === 1 ? "neighborhood or city" : "neighborhoods and cities"],
    [stats.prints.toLocaleString("en-US"), "prints sold"],
    [moneyRound(stats.earned), "earned by artists"],
  ];

  const promises: { color: string; title: string; text: string; href?: string; link?: string }[] = [
    { color: "var(--af-earned)", title: `${pct(split)} to the artist`, text: `Of the profit on every print, or ${pct(PRO.split)} on ${PRO.name}. Free to join.`, href: "/pricing", link: "See the math" },
    { color: "var(--af-coral)", title: "Damaged? Reprinted free", text: `Send a photo within ${HELP_DAYS_AFTER_DELIVERY} days of delivery and we print it again.`, href: "/return-policy", link: "Return policy" },
    { color: "var(--af-scan)", title: "Artists keep their rights", text: "Copyright stays with the artist. We never train AI on their work.", href: "/artist-terms-and-agreement", link: "Artist terms" },
    { color: "var(--af-sticker)", title: "Stolen art comes down", text: "Report it and we review within 2 business days.", href: "/dmca", link: "How takedowns work" },
    { color: "var(--af-ink)", title: "Real verification", text: "Our team checks every verified artist's portfolio and socials." },
    { color: "var(--af-ink-2)", title: "Safe checkout", text: "Payments run on Stripe. We never see card numbers." },
  ];

  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-10 pt-10 sm:px-6 md:pt-16">
        <h1 className="display max-w-[12ch] text-[56px] sm:text-[88px]">Local art, from paint <Brushed>to print.</Brushed></h1>
        {/* TODO(thomas): confirm story wording for nationwide */}
        <p className="mt-5 max-w-[40ch] text-[17px] text-ink-2">
          Artists hang a code by their work. We print, ship and pay them.
        </p>
      </section>

      {/* Live numbers */}
      <section aria-label="Artfinity in numbers" className="mx-auto max-w-[1240px] px-4 pb-12 sm:px-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-t-[3px] border-ink pt-6 md:grid-cols-4">
          {numbers.map(([n, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="t-section num">{n}</dd>
              <dd className="t-muted">{label}</dd>
            </div>
          ))}
        </dl>
        {stats.reviewCount > 0 && (
          <p className="t-muted mt-6 flex items-center gap-2">
            <Dabs value={stats.rating} size="sm" />
            <span><b className="text-ink">{stats.rating.toFixed(1)}</b> from {stats.reviewCount} verified buyer reviews</span>
          </p>
        )}
      </section>

      {/* Story + people */}
      <section className="mx-auto grid max-w-[1240px] gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:gap-16 md:py-24">
        <div>
          <h2 className="t-feature">Why we built it</h2>
          <div className="t-body mt-5 grid max-w-[60ch] gap-4 text-[17px] text-ink-2">
            {STORY.map((p) => <p key={p}>{p}</p>)}
          </div>
        </div>
        <div>
          <h2 className="t-feature">Who we are</h2>
          <ul className="mt-5 grid gap-4">
            {TEAM.map((m) => (
              <li key={m.name} className="af-card flex gap-4 p-5">
                <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[46%_54%_50%_50%] text-[32px] font-extrabold text-white" style={{ background: m.color }}>
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display" aria-hidden="true">{m.name[0]}</span>
                  )}
                </span>
                <div className="grid content-start gap-1">
                  <p className="t-card">{m.name} <span className="font-normal text-ink-2">· {m.role}</span></p>
                  <p className="t-muted">{m.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {wall.length > 0 && (
        <section aria-label="Art from Artfinity artists" className="relative overflow-hidden border-y border-line bg-gallery py-10 md:py-14">
          <BrushStroke className="pointer-events-none absolute -left-10 top-[42%] h-16 w-[70%] -rotate-3 opacity-40" color="var(--af-sticker)" />
          <div className="relative grid gap-8 md:gap-10">
            <SalonStrip art={wall.slice(0, half)} seconds={80} label="Prints by Artfinity artists" />
            <SalonStrip art={wall.slice(half)} seconds={95} reverse label="More prints by Artfinity artists" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-[#d7d1c4]" aria-hidden="true" />
        </section>
      )}

      {/* How a sale works, with real numbers */}
      <section className="border-y border-line bg-wall">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
          <h2 className="t-feature">Where your money goes</h2>
          <p className="t-muted mt-2">A Medium print at {money(example.price)}:</p>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              [money(example.cost), "Printing in NYC, paper and shipping"],
              [money(example.fee + example.hosting), "Card fees and hosting"],
              [money(example.artist), `To the artist (${pct(split)} of profit)`],
              [money(example.company), "To Artfinity, to keep the lights on"],
            ].map(([amount, label]) => (
              <li key={label} className="grid content-start gap-1 border-t-[3px] border-ink pt-4">
                <span className="t-section num">{amount}</span>
                <span className="t-muted">{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Promises */}
      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <h2 className="t-feature">What we promise</h2>
        <ul className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {promises.map((p) => (
            <li key={p.title} className="grid content-start gap-2 border-t-[3px] border-ink pt-5">
              <h3 className="t-card">{p.title}</h3>
              <p className="t-muted">{p.text}</p>
              {p.href && <Link href={p.href} className="text-[15px] font-bold underline underline-offset-2">{p.link}</Link>}
            </li>
          ))}
        </ul>
      </section>

      {/* Company details */}
      <section className="border-t border-line bg-wall">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h2 className="t-feature relative inline-block"><span className="relative z-10">Made in Brooklyn, NY.</span><BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-coral)" style={{ opacity: 0.45 }} /></h2>
            <p className="t-muted mt-2">Shipped across the US.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/art" className="btn btn-ghost btn-lg">Browse art</Link>
              <Link href="/register" className="btn btn-blue btn-lg">Start selling free</Link>
            </div>
          </div>
          <address className="af-panel grid gap-3 p-5 text-[15.5px] not-italic">
            <p><b>{COMPANY.legalName}</b><br />{COMPANY.address}</p>
            <p>
              <a href={`mailto:${COMPANY.email}`} className="font-bold underline underline-offset-2">{COMPANY.email}</a>
            </p>
            <p className="text-ink-2">{COMPANY.hours}</p>
            <Link href="/contact" className="btn btn-sm w-fit">Send a message</Link>
          </address>
        </div>
      </section>
    </>
  );
}
