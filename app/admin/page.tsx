import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "./_components/gate";
import { usd } from "./_components/util";
import { cn } from "@/lib/utils";
import { itemBreakdown } from "@/lib/sales";
import { activeRefunds } from "@/lib/refunds";
import { getBalance, latePayouts } from "@/lib/balance";
import { openRequestCount } from "@/lib/reprints";
import { shippedDates } from "@/lib/shipping/store";
import { DUPLICATE_PREFIX } from "@/lib/imageHash";
import { connectStatus } from "@/lib/stripeConnect";
import { integrationsHealth, type Health } from "@/lib/integrations";
import { TEST_DAYS, TEST_TARGET, testStart } from "@/lib/adminSettings";
import TestStartForm from "./_components/TestStartForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

const DAY = 86_400_000;
const SHIPPED_STALE_DAYS = 10;

/** Midnight today in New York, as a UTC instant. */
function nyMidnight(now: Date) {
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const offset = now.getTime() - ny.getTime();
  ny.setHours(0, 0, 0, 0);
  return new Date(ny.getTime() + offset);
}

type Window = { id: string; label: string; since: Date };

export default async function AdminDashboard() {
  await adminOrRedirect("/admin");
  const now = new Date();
  const windows: Window[] = [
    { id: "today", label: "Today", since: nyMidnight(now) },
    { id: "7d", label: "7 days", since: new Date(now.getTime() - 7 * DAY) },
    { id: "30d", label: "30 days", since: new Date(now.getTime() - 30 * DAY) },
  ];
  const since30 = windows[2].since;

  // ---------- Needs attention ----------
  const [pendingArt, duplicates, openReports, flaggedReviews, reprints, notSent, failedWo, shippedOrders, late, toVerify, stripePending] = await Promise.all([
    prisma.artwork.count({ where: { status: "PENDING", NOT: { flaggedReason: { startsWith: DUPLICATE_PREFIX } } } }),
    prisma.artwork.count({ where: { flaggedReason: { startsWith: DUPLICATE_PREFIX }, status: { not: "REJECTED" } } }),
    prisma.artReport.count({ where: { status: "open" } }),
    prisma.review.count({ where: { status: "flagged" } }),
    openRequestCount(),
    prisma.order.count({ where: { OR: [{ paymentStatus: "paid" }, { kind: "reprint" }], shippingStatus: "pending", sentToPrinter: false, printerSentAt: null } }),
    prisma.order.count({ where: { printerRef: { startsWith: "failed" }, shippingStatus: "pending" } }),
    prisma.order.findMany({ where: { shippingStatus: "shipped" }, select: { id: true, createdAt: true } }),
    latePayouts(now),
    prisma.artist.count({ where: { verification: "PENDING" } }),
    prisma.artist.findMany({ where: { stripeAccountId: { not: null }, stripePayoutsEnabled: false }, select: { id: true, stripeAccountId: true, stripePayoutsEnabled: true } }),
  ]);
  // Shipped date = Order.shippedAt, else when tracking was saved (older orders kept it as a Message), else the order date.
  const shippedAt = await shippedDates(shippedOrders.map((o) => o.id));
  const staleShipped = shippedOrders.filter((o) => (shippedAt.get(o.id) ?? o.createdAt).getTime() < now.getTime() - SHIPPED_STALE_DAYS * DAY).length;
  const lateArtists = new Set(late.map((l) => l.artistId)).size;
  let stripeWithBalance = 0;
  for (const a of stripePending.filter((a) => connectStatus(a) === "pending")) {
    const b = await getBalance(a.id, now);
    if (b.pendingCents + b.availableCents > 0) stripeWithBalance++;
  }

  const attention = [
    { n: pendingArt, label: "artworks waiting for review", href: "/admin/moderation" },
    { n: duplicates, label: "possible duplicates to compare", href: "/admin/moderation" },
    { n: openReports, label: "open reports (DMCA, AI, content)", href: "/admin/reports" },
    { n: flaggedReviews, label: "reviews held for a look", href: "/admin/reviews" },
    { n: reprints, label: "reprint requests", href: "/admin/reprints" },
    { n: notSent, label: "orders not sent to the printer", href: "/admin/orders?month=all&filter=print" },
    { n: failedWo, label: "work orders that failed to send", href: "/admin/orders?month=all&filter=print" },
    { n: staleShipped, label: `orders shipped ${SHIPPED_STALE_DAYS}+ days ago, not marked delivered`, href: "/admin/orders?month=all&filter=shipped" },
    { n: lateArtists, label: "artists with a late payout", href: "/admin/payouts" },
    { n: toVerify, label: "verification requests", href: "/admin/verification" },
    { n: stripeWithBalance, label: "artists with a balance who haven't finished Stripe setup", href: "/admin/artists?stripe=pending&balance=1" },
  ];
  const open = attention.filter((a) => a.n > 0);

  // ---------- Business numbers ----------
  const [items, scans, newArtists] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: since30 } } },
      select: { id: true, orderId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, qrCodeId: true, artwork: { select: { artistId: true } }, order: { select: { createdAt: true } } },
    }),
    prisma.scanEvent.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
    prisma.artist.findMany({ where: { createdAt: { gte: since30 }, role: "USER" }, select: { createdAt: true } }),
  ]);
  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.orderId))));
  const lines = items.filter((i) => !refunds.has(i.id)).map((i) => {
    const b = itemBreakdown({ ...i, orderDate: i.order.createdAt });
    return { at: i.order.createdAt, orderId: i.orderId, sales: b.lineTotal, profit: b.companyShare, prints: b.quantity, scan: !!i.qrCodeId, artistId: i.artwork?.artistId ?? null };
  });
  const stats = windows.map((w) => {
    const ls = lines.filter((l) => l.at >= w.since);
    const orders = new Set(ls.map((l) => l.orderId)).size;
    const scanOrders = new Set(ls.filter((l) => l.scan).map((l) => l.orderId)).size;
    const sales = ls.reduce((n, l) => n + l.sales, 0);
    const sc = scans.filter((s) => s.createdAt >= w.since).length;
    return {
      ...w,
      sales,
      profit: ls.reduce((n, l) => n + l.profit, 0),
      orders,
      prints: ls.reduce((n, l) => n + l.prints, 0),
      aov: orders ? Math.round(sales / orders) : 0,
      newArtists: newArtists.filter((a) => a.createdAt >= w.since).length,
      scans: sc,
      scanOrders,
      conversion: sc ? scanOrders / sc : null,
    };
  });
  const activeArtists = new Set(lines.map((l) => l.artistId).filter(Boolean)).size;

  // ---------- 90-day test ----------
  const start = await testStart();
  const firstOrder = start.date ? null : await prisma.order.findFirst({ where: { paymentStatus: "paid", kind: { not: "bulk" } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const startAt = start.date ? new Date(`${start.date}T00:00:00-05:00`) : firstOrder?.createdAt ?? now;
  const testItems = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: startAt } } },
    select: { id: true, orderId: true, quantity: true },
  });
  const testRefunds = await activeRefunds(Array.from(new Set(testItems.map((i) => i.orderId))));
  const sold = testItems.filter((i) => !testRefunds.has(i.id)).reduce((n, i) => n + (i.quantity || 1), 0);
  const elapsed = Math.max(0, Math.min(TEST_DAYS, Math.floor((now.getTime() - startAt.getTime()) / DAY)));
  const daysLeft = TEST_DAYS - elapsed;
  const remaining = Math.max(0, TEST_TARGET - sold);
  const pace = remaining === 0 ? 0 : daysLeft > 0 ? Math.ceil(remaining / (daysLeft / 7)) : null;
  const currentPace = elapsed >= 7 ? Math.round((sold / elapsed) * 7 * 10) / 10 : null;
  const onTrack = sold >= TEST_TARGET || (elapsed > 0 && sold / elapsed >= TEST_TARGET / TEST_DAYS);

  const health = integrationsHealth();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

  const rows: { label: string; fmt: (s: (typeof stats)[number]) => string; hint?: string }[] = [
    { label: "Sales", fmt: (s) => usd(s.sales), hint: "Print prices, before tax and shipping" },
    { label: "Artfinity profit", fmt: (s) => usd(s.profit), hint: "After printing, fees and the artist's share" },
    { label: "Orders", fmt: (s) => String(s.orders) },
    { label: "Prints", fmt: (s) => String(s.prints) },
    { label: "Average order", fmt: (s) => (s.orders ? usd(s.aov) : "—") },
    { label: "New artists", fmt: (s) => String(s.newArtists) },
    { label: "Scans", fmt: (s) => String(s.scans) },
    { label: "Scans → orders", fmt: (s) => (s.conversion == null ? "—" : `${(s.conversion * 100).toFixed(1)}%`), hint: "Orders from a scanned code ÷ scans" },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">{dateLabel}</p>
        <h1 className="display text-[44px] sm:text-[56px]">What needs you today</h1>
      </div>

      <section aria-labelledby="attn-h" className="af-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="attn-h" className="text-[20px] font-bold">Needs attention</h2>
          <span className="text-[13px] text-ink-2">{open.length ? `${open.reduce((n, a) => n + a.n, 0)} things in ${open.length} queues` : "All clear"}</span>
        </div>
        {open.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-[15px]"><span className="paint-dab h-5 w-5" style={{ ["--dab" as string]: "var(--af-earned)" }} />Nothing waiting. Go paint something.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {open.map((a) => (
              <li key={a.label}>
                <Link href={a.href} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-ink no-underline transition hover:border-ink">
                  <b className="num grid h-9 min-w-[36px] place-items-center rounded-full bg-coral/15 px-2 text-[16px] text-coral">{a.n}</b>
                  <span className="text-[14.5px] font-semibold">{a.label}</span>
                  <span aria-hidden="true" className="ml-auto text-ink-2">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {open.length > 0 && open.length < attention.length && (
          <p className="text-[12.5px] text-ink-2">Clear: {attention.filter((a) => a.n === 0).map((a) => a.label).join(" · ")}</p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="biz-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="biz-h" className="text-[20px] font-bold">Business numbers</h2>
            <span className="text-[13px] text-ink-2"><b className="num text-ink">{activeArtists}</b> active artists (sold in 30 days)</span>
          </div>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="num w-full text-[13px] sm:text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.06em] text-ink-2">
                  <th className="py-2 pr-2 font-bold" />
                  {stats.map((s) => <th key={s.id} className="py-2 pl-2 text-right font-bold">{s.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-2 pr-2 text-left font-semibold">
                      {r.label}
                      {r.hint && <span className="hidden text-[11.5px] font-normal text-ink-2 sm:block">{r.hint}</span>}
                    </th>
                    {stats.map((s) => <td key={s.id} className={cn("whitespace-nowrap py-2 pl-2 text-right", r.label === "Artfinity profit" && "font-semibold text-earned")}>{r.fmt(s)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-ink-2">Paid buyer orders only (bulk and free reprints excluded); refunded lines are left out. Today starts at midnight New York time.</p>
        </section>

        <section aria-labelledby="test-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <h2 id="test-h" className="text-[20px] font-bold">The 90-day test</h2>
          <div className="flex items-baseline gap-2">
            <b className="display num text-[52px] leading-none">{sold}</b>
            <span className="text-[16px] text-ink-2">of {TEST_TARGET} prints sold</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-wall ring-1 ring-line" role="progressbar" aria-valuemin={0} aria-valuemax={TEST_TARGET} aria-valuenow={Math.min(sold, TEST_TARGET)} aria-label="Prints sold toward the target">
            <div className={cn("h-full rounded-full", onTrack ? "bg-earned" : "bg-sticker")} style={{ width: `${Math.min(100, (sold / TEST_TARGET) * 100)}%` }} />
          </div>
          <div className="relative h-0">
            {/* where you'd be at an even pace */}
            <span aria-hidden="true" className="absolute -top-5 h-4 w-0.5 bg-ink/50" style={{ left: `${(elapsed / TEST_DAYS) * 100}%` }} title="Even pace" />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <div><dt className="text-ink-2">Day</dt><dd className="num font-semibold">{Math.min(elapsed + 1, TEST_DAYS)} of {TEST_DAYS}</dd></div>
            <div><dt className="text-ink-2">Days left</dt><dd className="num font-semibold">{daysLeft}</dd></div>
            <div><dt className="text-ink-2">Needed per week</dt><dd className="num font-semibold">{remaining === 0 ? "Target hit 🎉" : pace == null ? `Ended ${remaining} short` : `${pace} prints`}</dd></div>
            <div><dt className="text-ink-2">Current pace</dt><dd className="num font-semibold">{currentPace == null ? "—" : `${currentPace} / week`}</dd></div>
          </dl>
          <p className="text-[12.5px] text-ink-2">
            {onTrack ? "On track." : "Behind an even pace."} Started {startAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}
            {start.source === "env" ? " (TEST_START_DATE)" : start.source === "file" ? " (saved setting)" : " (first order)"}. The tick marks an even pace.
          </p>
          {start.source !== "env" && <TestStartForm value={start.date ?? ""} />}
        </section>
      </div>

      <section aria-labelledby="int-h" className="af-card grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="int-h" className="text-[20px] font-bold">Integrations</h2>
          <span className="text-[13px] text-ink-2">From the server&apos;s settings. Values are never shown.</span>
        </div>
        <ul className="grid gap-x-6 gap-y-1 md:grid-cols-2">
          {health.map((h) => (
            <li key={h.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3 border-b border-line py-2.5 last:border-b-0 md:[&:nth-last-child(2)]:border-b-0">
              <Dot s={h.status} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2"><b className="text-[14.5px]">{h.name}</b><span className="text-[13px] text-ink-2">{h.state}</span></p>
                {h.fix && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{h.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const DOT: Record<Health, { c: string; label: string }> = {
  green: { c: "var(--af-earned)", label: "OK" },
  amber: { c: "#e3b23c", label: "Needs a look" },
  red: { c: "var(--af-coral)", label: "Broken or missing" },
};
function Dot({ s }: { s: Health }) {
  return <span role="img" aria-label={DOT[s].label} title={DOT[s].label} className="mt-1.5 inline-block h-3 w-3 rounded-full" style={{ background: DOT[s].c }} />;
}
