import Link from "next/link";
import { Brushed, PaintChip } from "@/components/af/Brush";
import Greeting from "@/components/studio/Greeting";
import NextSteps from "@/components/studio/NextSteps";
import SalesChart, { type DayPoint } from "@/components/studio/SalesChart";
import { money } from "@/lib/earnings";
import { requireArtist, firstName, getSales, getArtworks, dayKey, serverGreeting, timeAgo, SIZE_LABEL, STUDIO_TZ } from "./_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio" };

const DAY = 86400000;

function BrushIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M14.5 3.5l6 6-8.2 8.2c-.6.6-1.5.7-2.2.3l-3.8-3.8c-.4-.7-.3-1.6.3-2.2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M5.8 14.6c-2 .4-2.6 2.2-2.8 5.9 3.7-.2 5.5-.8 5.9-2.8" fill="currentColor" />
    </svg>
  );
}

export default async function StudioHome() {
  const artist = await requireArtist("/studio");
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY);
  const [allSales, artworks] = await Promise.all([getSales(artist.id), getArtworks(artist.id)]);
  const sales = allSales.filter((s) => s.date >= since);

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

  const live = artworks.filter((a) => a.status !== "REJECTED");

  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="display text-[clamp(34px,5vw,52px)]">
            <Greeting initial={serverGreeting(now)} />, <Brushed>{firstName(artist)}</Brushed>
          </h1>
          <p className="mt-2 text-[14px] text-ink-2">Last 30 days</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/studio/qr" className="btn btn-ghost">Print codes</Link>
          <Link href="/studio/art/new" className="btn btn-blue"><BrushIcon />Upload art</Link>
        </div>
      </div>

      <section aria-label="Last 30 days" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <PaintChip color="#e8743b" value={prints.toLocaleString("en-US")} label="prints sold" note={`Cadmium · ${sales.length} ${sales.length === 1 ? "order" : "orders"}`} />
        <PaintChip color="#0f7a55" value={money(earned)} label="you earned" note="Viridian · your share of profit" earned />
        <PaintChip color="#ffd43b" value={best ? best.title : "None yet"} label="best seller" note={best ? `Naples Yellow · ${best.prints} sold` : "Naples Yellow · hang a code"} />
        <div className="relative">
          <PaintChip color="#2b37f0" value="1,284" label="scans" note="Preview, tracking coming soon" />
          <span className="sticker-badge absolute right-2 top-2 text-[11px]">Preview</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="chart-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="chart-h" className="text-[20px] font-bold">Prints sold, by day</h2>
            <span className="num text-[12.5px] text-ink-2">{prints} in 30 days</span>
          </div>
          <SalesChart days={days} />
        </section>

        <NextSteps hasProfile={!!artist.profileImage && !!artist.bio?.trim()} hasArt={artworks.length > 0} hasSold={allSales.length > 0} slug={artist.slug} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="recent-h">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="recent-h" className="text-[20px] font-bold">Just sold</h2>
            <Link href="/studio/sales" className="text-[13px] font-bold text-scan">All sales</Link>
          </div>
          {allSales.length === 0 ? (
            <p className="text-[14px] text-ink-2">No sales yet. Hang a code where people linger.</p>
          ) : (
            <ul className="grid gap-3">
              {allSales.slice(0, 6).map((s) => (
                <li key={s.id} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-start gap-2.5 text-[14px]">
                  <i className="paint-dab mt-1 h-3 w-3" style={{ ["--dab" as string]: "#0f7a55" }} />
                  <div className="min-w-0">
                    <b className="block">{SIZE_LABEL[s.size]} print sold{s.quantity > 1 ? ` ×${s.quantity}` : ""}</b>
                    <span className="block truncate text-[12.5px] text-ink-2">{s.title} · {timeAgo(s.date, now)}</span>
                  </div>
                  <em className="num not-italic font-bold text-earned">+{money(s.shareCents)}</em>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="top-h">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="top-h" className="text-[20px] font-bold">Top pieces</h2>
            <span className="text-[12.5px] text-ink-2">30 days</span>
          </div>
          {top.length === 0 ? (
            <p className="text-[14px] text-ink-2">Your best sellers show up here.</p>
          ) : (
            <ol className="grid gap-2.5">
              {top.slice(0, 4).map((p, i) => (
                <li key={p.slug || p.title} className="flex items-center gap-3 text-[14px]">
                  <span className="num w-4 text-[12.5px] font-bold text-ink-2">{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-[3px] object-cover" />}
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{p.title}</b>
                    <span className="num block text-[12.5px] text-ink-2">{p.prints} sold</span>
                  </div>
                  <span className="num font-bold text-earned">{money(p.earned)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="art-h">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="art-h" className="text-[20px] font-bold">My art</h2>
          <Link href="/studio/art" className="text-[13px] font-bold text-scan">{live.length} {live.length === 1 ? "piece" : "pieces"}</Link>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {artworks.slice(0, 5).map((a) => (
            <Link key={a.id} href={`/studio/art/${a.slug}`} className="group grid content-start gap-1.5 text-[12.5px] text-ink no-underline">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[3px] bg-gallery shadow-[0_2px_0_var(--af-line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
              </span>
              <span className="truncate font-semibold">{a.title}</span>
            </Link>
          ))}
          <Link href="/studio/art/new" className="grid aspect-[4/5] place-items-center content-center gap-2 rounded-[3px] border-2 border-dashed border-line text-center text-[13px] font-bold text-ink-2 no-underline hover:border-ink hover:text-ink">
            <i className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "#2b37f0" }} />
            Add a piece
          </Link>
        </div>
      </section>
    </div>
  );
}
