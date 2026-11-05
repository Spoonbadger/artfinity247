import Link from "next/link";
import { Brushed } from "@/components/af/Brush";
import Greeting from "@/components/studio/Greeting";
import NextSteps from "@/components/studio/NextSteps";
import SalesChart, { type DayPoint } from "@/components/studio/SalesChart";
import MedalProgress from "@/components/artist/MedalProgress";
import { getArtistTrust } from "@/lib/artistTrust";
import ProCard from "@/components/pro/ProCard";
import { getArtistPlan } from "@/components/pro/plan.server";
import { prisma } from "@/lib/prisma";
import { countArtistScans } from "@/lib/shortlinks";
import { countArtistViews } from "@/lib/pageviews";
import { getBalance } from "@/lib/balance";
import { dayUTC } from "@/components/money/format";
import { EmptyState } from "@/components/studio/EmptyState";
import { Upload } from "lucide-react";
import { readScanSettings } from "@/lib/scanning.server";
import { requireArtist, firstName, getSales, getArtworks, dayKey, serverGreeting, timeAgo, SIZE_LABEL, STUDIO_TZ, usd } from "./_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio" };

const DAY = 86400000;

/** One number on the dashboard: small dab, label, big value, one quiet line. The whole tile links somewhere. */
function Stat({ href, dab, label, value, note, tone }: { href: string; dab: string; label: string; value: string; note: string; tone?: "earned" | "late" }) {
  return (
    <Link href={href} className="af-card grid min-w-0 content-start gap-1 p-4 text-ink no-underline transition-colors hover:border-ink">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
        <i aria-hidden="true" className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: dab }} />
        {label}
      </span>
      <b className={`display num text-[28px] leading-tight sm:text-[32px] ${tone === "earned" ? "text-earned" : "text-ink"}`}>{value}</b>
      <span className={`truncate text-[12.5px] ${tone === "late" ? "font-semibold text-coral" : "text-ink-2"}`}>{note}</span>
    </Link>
  );
}

export default async function StudioHome() {
  const artist = await requireArtist("/studio");
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY);
  const [allSales, artworks, trust, ver, plan, balance, eventCount, codeCount] = await Promise.all([
    getSales(artist.id),
    getArtworks(artist.id),
    getArtistTrust(artist.id),
    prisma.artist.findUnique({ where: { id: artist.id }, select: { verification: true } }),
    getArtistPlan(artist.id),
    getBalance(artist.id, now),
    prisma.studioEvent.count({ where: { artistId: artist.id } }),
    prisma.qrCode.count({ where: { artistId: artist.id } }),
  ]);
  const sales = allSales.filter((s) => s.date >= since);
  // Painting scans: suggest one when more than one piece can't print at the biggest size (lib/scanning.server.ts).
  const [scanOn, limitedCount, scanOpen] = await Promise.all([
    readScanSettings().then((s) => s.enabled).catch(() => false),
    prisma.artwork.count({ where: { artistId: artist.id, status: { not: "REJECTED" }, printableSizes: { isEmpty: false }, NOT: { printableSizes: { has: "xl" } } } }),
    prisma.scanBooking.count({ where: { artistId: artist.id, status: { in: ["requested", "confirmed", "paid", "scanning"] } } }),
  ]);
  const scanSuggestion = limitedCount > 1 && !scanOpen
    ? { label: `${limitedCount} pieces can't print at XL yet`, note: scanOn ? "We scan the originals in NYC so every size prints sharp." : "Painting scans are coming soon. Join the waitlist.", href: "/studio/scanning", act: scanOn ? "Book a scan" : "Join" }
    : null;
  // Real scans of the artist's short link codes: last 30 days vs the 30 before.
  const [scans, scansBefore, viewsWeek] = await Promise.all([
    countArtistScans(artist.id, since, now),
    countArtistScans(artist.id, new Date(since.getTime() - 30 * DAY), since),
    countArtistViews(artist.id, new Date(now.getTime() - 7 * DAY), now),
  ]);
  const scanDelta = !scans && !scansBefore ? (codeCount ? "Hang your codes to start" : "Print a code to start") : !scansBefore ? "New this month" : `${scans >= scansBefore ? "+" : "−"}${Math.abs(Math.round(((scans - scansBefore) / scansBefore) * 100))}% on the 30 days before`;

  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const earned = sales.reduce((n, s) => n + s.shareCents, 0);

  const byPiece = new Map<string, { title: string; slug: string | null; imageUrl: string | null; prints: number; earned: number }>();
  for (const s of sales) {
    const k = s.slug || s.title;
    const p = byPiece.get(k) || { title: s.title, slug: s.slug, imageUrl: s.imageUrl, prints: 0, earned: 0 };
    p.prints += s.quantity;
    p.earned += s.shareCents;
    byPiece.set(k, p);
  }
  const top = Array.from(byPiece.values()).sort((a, b) => b.prints - a.prints || b.earned - a.earned);
  const best = top[0];

  const days: DayPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    days.push({ key: dayKey(d), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: STUDIO_TZ }), prints: 0, earnedCents: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));
  for (const s of sales) {
    const i = dayIndex.get(dayKey(s.date));
    if (i !== undefined) { days[i].prints += s.quantity; days[i].earnedCents += s.shareCents; }
  }

  const hasArt = artworks.length > 0;
  const hasSold = allSales.length > 0;
  const balanceCents = balance.pendingCents + balance.availableCents;
  const late = balance.lateMonths.length > 0;

  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <h1 className="display min-w-0 text-[clamp(34px,5vw,50px)]">
          <Greeting initial={serverGreeting(now)} />, <Brushed>{firstName(artist)}</Brushed>
        </h1>
        <Link href="/studio/art/new" className="btn btn-blue"><Upload className="h-4 w-4" aria-hidden="true" />Upload art</Link>
      </div>

      {/* What to do next. Hides itself once everything is done. */}
      <NextSteps hasProfile={!!artist.profileImage && !!artist.bio?.trim()} hasArt={hasArt} hasSold={hasSold} hasVenmo={!!artist.venmoHandle || balance.payoutVia === "stripe"} hasEvent={eventCount > 0} slug={artist.slug} suggestion={scanSuggestion} />

      {/* How it's going: four numbers, each a link to the full story. Nothing to count before the first upload. */}
      {hasArt && (
        <section aria-labelledby="stats-h" className="grid gap-3">
          <h2 id="stats-h" className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-2">Last 30 days</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat href="/studio/sales" dab="#0f7a55" label="You earned" value={usd(earned)} note={sales.length ? `${sales.length} ${sales.length === 1 ? "order" : "orders"}` : "Your 60% of each sale's profit"} tone="earned" />
            <Stat href="/studio/sales" dab="#e8743b" label="Prints sold" value={prints.toLocaleString("en-US")} note={best ? `Best: ${best.title}` : "None yet"} />
            <Stat href="/studio/codes" dab="#2b37f0" label="Scans" value={scans.toLocaleString("en-US")} note={scanDelta} />
            <Stat href="/studio/money" dab="#0f7a55" label="Balance" value={usd(balanceCents)} note={late ? "Payout late. See Money" : `Paid ${dayUTC(balance.nextPayout.date)}`} tone={late ? "late" : undefined} />
          </div>
        </section>
      )}

      {hasArt && (hasSold ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="chart-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="chart-h" className="text-[18px] font-bold">Prints sold, by day</h2>
              <Link href="/studio/analytics" className="-my-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-ink-2 hover:text-ink">
                {viewsWeek ? `${viewsWeek.toLocaleString("en-US")} page views this week` : "Analytics"}
              </Link>
            </div>
            {prints > 0 ? (
              <SalesChart days={days} />
            ) : (
              <EmptyState compact dab="#e8743b" title="No sales in the last 30 days" body="Hang a code somewhere new. Cafés and markets work well." action={{ label: "Print a code", href: "/studio/qr" }} help={{ label: "Where to hang codes", href: "/help/getting-started/hanging-codes" }} />
            )}
          </section>

          <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="recent-h">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="recent-h" className="text-[18px] font-bold">Just sold</h2>
              <Link href="/studio/sales" className="-my-3 inline-flex min-h-[44px] items-center text-[14px] font-bold text-scan">All sales</Link>
            </div>
            <ul className="grid gap-3">
              {allSales.slice(0, 5).map((s) => (
                <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-[14px]">
                  <div className="min-w-0">
                    <b className="block truncate">{s.title}</b>
                    <span className="block truncate text-[12.5px] text-ink-2">{SIZE_LABEL[s.size]}{s.quantity > 1 ? ` ×${s.quantity}` : ""} · {timeAgo(s.date, now)}</span>
                  </div>
                  <em className="num not-italic font-bold text-earned">+{usd(s.shareCents)}</em>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <EmptyState
          dab="#0f7a55"
          title="No sales yet"
          body="Hang a code beside each painting. Every sale shows up here with what you earned."
          action={{ label: "Print a code", href: "/studio/qr" }}
          help={{ label: "Where to hang codes", href: "/help/getting-started/hanging-codes" }}
        />
      ))}

      {hasArt && (
        <div className="grid gap-4 lg:grid-cols-2">
          {top.length > 0 && (
            <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="top-h">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="top-h" className="text-[18px] font-bold">Top pieces</h2>
                <Link href="/studio/art" className="-my-3 inline-flex min-h-[44px] items-center text-[14px] font-bold text-scan">My art</Link>
              </div>
              <ol className="grid gap-2.5">
                {top.slice(0, 4).map((p, i) => (
                  <li key={p.slug || p.title} className="flex items-center gap-3 text-[14px]">
                    <span className="num w-4 text-[12.5px] font-bold text-ink-2">{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.imageUrl && <img src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />}
                    <div className="min-w-0 flex-1">
                      <b className="block truncate">{p.title}</b>
                      <span className="num block text-[12.5px] text-ink-2">{p.prints} sold</span>
                    </div>
                    <span className="num font-bold text-earned">{usd(p.earned)}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <MedalProgress trust={trust} verification={ver?.verification ?? "NONE"} />
        </div>
      )}

      {hasArt && <ProCard active={plan.active} proUntil={plan.proUntil} />}
    </div>
  );
}
