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
import { PageHead, Panel, Pill } from "./_components/ui";
import { EmptyState } from "@/components/studio/EmptyState";
import { openAlerts } from "@/lib/alerts";
import { kindMeta } from "@/lib/alertKinds";
import { billingOverview } from "@/lib/billing";
import { PRO } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Home" };

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

  // Open alerts not snoozed. Urgent ones are listed one by one; the rest only when no queue below covers them.
  const alerts = await openAlerts().catch(() => []);
  const [codeOrders, scanBookings] = await Promise.all([
    prisma.codePrintOrder.count({ where: { status: "paid" } }).catch(() => 0),
    prisma.scanBooking.count({ where: { status: "requested" } }).catch(() => 0),
  ]);
  // Just one waiting: open that exact item, not the list it sits in.
  const [oneCode, oneScan, oneUnsent, oneFailed] = await Promise.all([
    codeOrders === 1 ? prisma.codePrintOrder.findFirst({ where: { status: "paid" }, select: { id: true } }).catch(() => null) : null,
    scanBookings === 1 ? prisma.scanBooking.findFirst({ where: { status: "requested" }, select: { id: true } }).catch(() => null) : null,
    notSent === 1 ? prisma.order.findFirst({ where: { OR: [{ paymentStatus: "paid" }, { kind: "reprint" }], shippingStatus: "pending", sentToPrinter: false, printerSentAt: null }, select: { id: true } }) : null,
    failedWo === 1 ? prisma.order.findFirst({ where: { printerRef: { startsWith: "failed" }, shippingStatus: "pending" }, select: { id: true } }) : null,
  ]);
  const COVERED = new Set(["report", "reprint", "duplicate", "moderation", "review_flagged", "verification", "work_order_failed", "order_stuck", "order_undelivered", "payout_late", "code_print_order", "scan_booking"]);
  const urgent = alerts.filter((a) => a.severity === "urgent");
  const otherAlerts = alerts.filter((a) => a.severity !== "urgent" && !COVERED.has(a.kind)).length;

  // Most urgent first: money and buyers waiting, then the review queues.
  const queue = ([
    ...urgent.map((a) => ({ key: a.id, n: 0, label: a.title, sub: kindMeta(a.kind).label, href: a.link || kindMeta(a.kind).queue, action: "Open", urgent: true })),
    { key: "wo", n: failedWo, label: "Work orders failed to send", href: oneFailed ? `/admin/orders/${oneFailed.id}` : "/admin/orders?month=all&filter=print", action: "Retry" },
    { key: "print", n: notSent, label: "Orders not sent to the printer", href: oneUnsent ? `/admin/orders/${oneUnsent.id}` : "/admin/orders?month=all&filter=print", action: "Send" },
    { key: "late", n: lateArtists, label: "Artists with a late payout", href: "/admin/payouts", action: "Pay" },
    { key: "reports", n: openReports, label: "Reports (DMCA, AI, content)", href: "/admin/reports", action: "Review" },
    { key: "reprints", n: reprints, label: "Reprint requests", href: "/admin/reprints", action: "Review" },
    { key: "codes", n: codeOrders, label: "Code orders to print", href: oneCode ? `/admin/code-orders/${oneCode.id}` : "/admin/code-orders?status=paid", action: "Print" },
    { key: "scans", n: scanBookings, label: "Scan bookings to confirm", href: oneScan ? `/admin/scanning/${oneScan.id}` : "/admin/scanning", action: "Confirm" },
    { key: "mod", n: pendingArt, label: "Artworks to review", href: "/admin/moderation", action: "Review" },
    { key: "dupes", n: duplicates, label: "Possible duplicates", href: "/admin/moderation", action: "Compare" },
    { key: "verify", n: toVerify, label: "Verification requests", href: "/admin/verification", action: "Review" },
    { key: "reviews", n: flaggedReviews, label: "Reviews held", href: "/admin/reviews", action: "Check" },
    { key: "shipped", n: staleShipped, label: `Shipped ${SHIPPED_STALE_DAYS}+ days ago, not delivered`, href: "/admin/orders?month=all&filter=shipped", action: "Check" },
    { key: "stripe", n: stripeWithBalance, label: "Owed money, Stripe not finished", href: "/admin/artists?stripe=pending&balance=1", action: "See" },
    { key: "alerts", n: otherAlerts, label: "Other open alerts", href: "/admin/alerts", action: "See" },
  ] as Todo[]).filter((t) => t.urgent || t.n > 0);
  const total = queue.reduce((n, t) => n + (t.urgent ? 1 : t.n), 0);

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

  const infinity = await billingOverview().catch(() => null);
  const health = integrationsHealth();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" });

  const rows: { label: string; fmt: (s: (typeof stats)[number]) => string; hint?: string }[] = [
    { label: "Sales", fmt: (s) => usd(s.sales), hint: "Print prices, before tax and shipping" },
    { label: "Profit", fmt: (s) => usd(s.profit), hint: "After printing, fees and the artist's share" },
    { label: "Orders", fmt: (s) => String(s.orders) },
    { label: "Prints", fmt: (s) => String(s.prints) },
    { label: "Average order", fmt: (s) => (s.orders ? usd(s.aov) : "—") },
    { label: "New artists", fmt: (s) => String(s.newArtists) },
    { label: "Scans", fmt: (s) => String(s.scans) },
    { label: "Scans → orders", fmt: (s) => (s.conversion == null ? "—" : `${(s.conversion * 100).toFixed(1)}%`), hint: "Orders from a scanned code ÷ scans" },
  ];

  const issues = health.filter((h) => h.status !== "green");
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

  return (
    <div className="grid gap-6">
      <PageHead title="Needs you now" sub={`${dateLabel} · ${total ? `${total} to do` : "all clear"}`} />

      <section aria-label="To do, most urgent first" className="af-panel overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-4"><EmptyState compact title="Nothing waiting" body="Every queue is clear." dab="var(--af-earned)" /></div>
        ) : (
          <ol className="divide-y divide-line">
            {queue.map((t, i) => (
              <li key={t.key} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                {t.urgent ? (
                  <Pill tone="red" className="min-w-[44px] justify-center">Urgent</Pill>
                ) : (
                  <b className="num grid h-8 min-w-[44px] place-items-center rounded-full bg-coral/15 px-2 text-[15px] text-coral">{t.n}</b>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[15px] font-semibold leading-snug">{t.label}</p>
                  {t.sub && <p className="text-[13px] text-ink-2">{t.sub}</p>}
                </div>
                <Link href={t.href} className={cn("btn btn-sm shrink-0 min-w-[84px]", i === 0 ? "btn-blue" : "btn-ghost")}>{t.action}</Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Numbers" action={<span className="text-[13px] text-ink-2"><b className="num text-ink">{activeArtists}</b> artists sold in 30 days</span>}>
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="num w-full text-[13px] sm:text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] uppercase tracking-[0.06em] text-ink-2">
                  <th scope="col" className="py-2 pr-2 font-bold"><span className="sr-only">Metric</span></th>
                  {stats.map((s) => <th key={s.id} scope="col" className="py-2 pl-2 text-right font-bold">{s.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-2 pr-2 text-left font-semibold" title={r.hint}>{r.label}</th>
                    {stats.map((s) => <td key={s.id} className={cn("whitespace-nowrap py-2 pl-2 text-right", r.label === "Profit" && "font-semibold text-earned")}>{r.fmt(s)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="text-[13px] text-ink-2">
            <summary className="cursor-pointer font-semibold text-ink">How these are counted</summary>
            <ul className="mt-2 grid list-disc gap-1 pl-5">
              <li>Paid buyer orders only. Bulk, free reprints and refunded lines are left out.</li>
              <li>Sales = print prices before tax and shipping.</li>
              <li>Profit = after printing, fees and the artist&apos;s share.</li>
              <li>Scans → orders = orders from a scanned code ÷ scans.</li>
              <li>Today starts at midnight New York time.</li>
            </ul>
          </details>
          {infinity && (
            <details className="border-t border-line pt-3">
              <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 text-[14px] font-semibold">
                {PRO.name} <span className="num text-earned">{usd(infinity.mrrCents)} MRR</span><span className="num font-normal text-ink-2">· {infinity.paying} paying</span>
                {infinity.failing ? <Pill tone="red">{infinity.failing} failed payment{infinity.failing === 1 ? "" : "s"}</Pill> : null}
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px] sm:grid-cols-4">
                <div><dt className="text-[12px] text-ink-2">Paying</dt><dd className="num text-[18px] font-bold">{infinity.paying}{infinity.yearly ? <span className="text-[12px] font-normal text-ink-2"> ({infinity.yearly} yearly)</span> : null}</dd></div>
                <div><dt className="text-[12px] text-ink-2">Free months first</dt><dd className="num text-[18px] font-bold">{infinity.trialing}</dd></div>
                <div><dt className="text-[12px] text-ink-2">On {PRO.name} (any way)</dt><dd className="num text-[18px] font-bold">{infinity.infinityNow}</dd></div>
                <div><dt className="text-[12px] text-ink-2">Cancelling</dt><dd className="num text-[18px] font-bold">{infinity.cancelling}</dd></div>
              </dl>
              <p className="mt-2 text-[12px] text-ink-2">
                MRR = paying × {usd(PRO.priceCents)} ({usd(PRO.yearlyMonthlyCents)}/mo yearly). Referral months not counted.{infinity.simulated ? " Test mode." : ""}
              </p>
            </details>
          )}
        </Panel>

        <Panel title="90-day test">
          <div className="flex items-baseline gap-2">
            <b className="display num text-[44px] leading-none">{sold}</b>
            <span className="text-[15px] text-ink-2">of {TEST_TARGET} prints</span>
            <Pill tone={onTrack ? "green" : "amber"} className="ml-auto">{onTrack ? "On track" : "Behind"}</Pill>
          </div>
          <div className="relative">
            <div className="h-3 overflow-hidden rounded-full bg-wall ring-1 ring-line" role="progressbar" aria-valuemin={0} aria-valuemax={TEST_TARGET} aria-valuenow={Math.min(sold, TEST_TARGET)} aria-label="Prints sold toward the target">
              <div className={cn("h-full rounded-full", onTrack ? "bg-earned" : "bg-sticker")} style={{ width: `${Math.min(100, (sold / TEST_TARGET) * 100)}%` }} />
            </div>
            <span aria-hidden="true" className="absolute -top-1 h-5 w-0.5 bg-ink/50" style={{ left: `${(elapsed / TEST_DAYS) * 100}%` }} title="Even pace" />
          </div>
          <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <div><dt className="text-[12px] text-ink-2">Day</dt><dd className="font-semibold">{Math.min(elapsed + 1, TEST_DAYS)} of {TEST_DAYS}</dd></div>
            <div><dt className="text-[12px] text-ink-2">Need per week</dt><dd className="font-semibold">{remaining === 0 ? "Target hit" : pace == null ? `Ended ${remaining} short` : `${pace} prints`}</dd></div>
            <div><dt className="text-[12px] text-ink-2">Pace</dt><dd className="font-semibold">{currentPace == null ? "—" : `${currentPace} / week`}</dd></div>
            <div><dt className="text-[12px] text-ink-2">Started</dt><dd className="font-semibold">{day(startAt)}</dd></div>
          </dl>
          <details className="text-[13px] text-ink-2">
            <summary className="cursor-pointer font-semibold text-ink">Start date</summary>
            <p className="mt-2">
              From {start.source === "env" ? "TEST_START_DATE" : start.source === "file" ? "a saved setting" : "the first order"}. The tick marks an even pace.
            </p>
            {start.source !== "env" && <TestStartForm value={start.date ?? ""} />}
          </details>
        </Panel>
      </div>

      <details id="integrations" className="af-panel group p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
          <h2 className="t-card">Integrations</h2>
          {issues.length ? <Pill tone="amber">{issues.length} need a look</Pill> : <Pill tone="green">All OK</Pill>}
          <span className="ml-auto text-[13px] font-semibold text-ink-2 group-open:hidden">Show</span>
          <span className="ml-auto hidden text-[13px] font-semibold text-ink-2 group-open:inline">Hide</span>
        </summary>
        <ul className="mt-3 grid gap-x-6 md:grid-cols-2">
          {[...issues, ...health.filter((h) => h.status === "green")].map((h) => (
            <li key={h.id} className="grid grid-cols-[14px_minmax(0,1fr)] gap-x-3 border-b border-line py-2.5">
              <Dot s={h.status} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2"><b className="text-[14.5px]">{h.name}</b><span className="text-[13px] text-ink-2">{h.state}</span></p>
                {h.fix && <p className="mt-0.5 break-words text-[13px] leading-snug text-ink-2">{h.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-ink-2">From the server&apos;s settings. Values are never shown.</p>
      </details>
    </div>
  );
}

type Todo = { key: string; n: number; label: string; sub?: string; href: string; action: string; urgent?: boolean };

const DOT: Record<Health, { c: string; label: string }> = {
  green: { c: "var(--af-earned)", label: "OK" },
  amber: { c: "#e3b23c", label: "Needs a look" },
  red: { c: "var(--af-coral)", label: "Broken or missing" },
};
function Dot({ s }: { s: Health }) {
  return <span role="img" aria-label={DOT[s].label} title={DOT[s].label} className="mt-1.5 inline-block h-3 w-3 rounded-full" style={{ background: DOT[s].c }} />;
}
