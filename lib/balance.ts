// lib/balance.ts
// THE single source of truth for an artist's balance: what's incoming, what's waiting
// for the next monthly payout, and what's been paid. All money in CENTS.
//
// Per-sale money comes from lib/revenue.ts (calcItemProfitCents, using the split stored on
// OrderItem.artistSplit), the same math as /admin/payouts and /api/admin/payouts/summary.
// Sales are booked to their UTC calendar month ("2026-10"), same as the admin pages and the
// Payout model, so a month's total here always equals the admin summary's artistShare.
// Server only (Prisma).
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { calcItemProfitCents } from "@/lib/revenue";
import { normalizeSize } from "@/lib/sales";
import type { PrintSize } from "@/lib/revenue";
import { connectStatus, type ConnectStatus } from "@/lib/stripeConnect";
import { activeRefunds, shareAfterRefund } from "@/lib/refunds";

/**
 * BUSINESS DECISION: the return window. A sale stays "pending" (incoming) for this many days
 * after the order date, so a return or reprint can still be settled before the money is counted
 * as available.
 */
export const RETURN_WINDOW_DAYS = 14;

/**
 * BUSINESS DECISION: payout day. Artfinity sends each month's earnings by this day of the
 * following month (Sell with us and the artist terms both say "by the 5th of the following month").
 * Payouts are sent by Artfinity ("Pay all" in /admin/payouts sends Stripe transfers to connected artists; Venmo
 * months are paid by hand and marked paid); artists never start one.
 *
 * Note: with a 14-day window, orders from the last ~9 days of a month are still in the window on
 * the 5th. The admin pays whole months, so those sales ARE in that payout; they show as pending
 * until they clear and are reported in nextPayout.clearingCents.
 */
export const PAYOUT_DAY_OF_MONTH = 5;

const DAY_MS = 86_400_000;

/** A month's payout counts as late once it is still unpaid this many days after the 5th. */
export const LATE_AFTER_DAYS = 3;

export type LedgerStatus = "pending" | "available" | "paid";
export type PayoutStatus = "paid" | "scheduled" | "in_progress";

export type LedgerLine = {
  id: string;
  orderId: string;
  /** ISO order date. */
  date: string;
  /** ISO date the 14-day window ends. */
  clearsAt: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  size: PrintSize;
  framed: boolean;
  quantity: number;
  buyerFirst: string;
  buyerCity: string;
  /** Opaque key for repeat-buyer counts (hash of the order email); never the email itself. */
  buyerKey: string;
  /** Where the sale came from: the printed code's label or venue (OrderItem.qrCodeId), else null. */
  source: string | null;
  grossCents: number;
  printingCents: number;
  feesCents: number;
  profitCents: number;
  /** 0.6 = 60% */
  split: number;
  shareCents: number;
  status: LedgerStatus;
  /** UTC month the sale is booked to, "YYYY-MM" (the Payout.month it's paid under). */
  payoutMonth: string;
  /** Refunded to the buyer (lib/refunds.ts): "reversed" = share taken back (shareCents is 0), "kept" = refunded after it was paid out. */
  refunded?: "reversed" | "kept" | null;
};

export type PayoutRow = {
  month: string;
  label: string;
  /** Recorded Payout.amountCents for paid months, else today's total for the month. */
  amountCents: number;
  /** Today's recompute from the sales (differs from amountCents only if a paid month changed later). */
  computedCents: number;
  status: PayoutStatus;
  paidAt: string | null;
  /** ISO date it goes out (scheduled / in progress) or was due (paid). */
  dueDate: string;
  method: string;
  sales: number;
  prints: number;
};

export type Balance = {
  now: string;
  currentMonth: string;
  pendingCents: number;
  availableCents: number;
  thisMonthCents: number;
  paidTotalCents: number;
  lifetimeCents: number;
  /** paidTotal (recorded) minus the recompute of those months' sales. 0 unless a paid month drifted. */
  adjustmentCents: number;
  nextPayout: {
    date: string;
    amountCents: number;
    months: string[];
    /** Part of amountCents still inside the return window. */
    clearingCents: number;
    /** True when the payout is a projection for the open month (nothing is owed yet). */
    projected: boolean;
    /** True when the due date has passed and the months aren't marked paid yet. */
    late: boolean;
  };
  /** Closed months still unpaid more than LATE_AFTER_DAYS after their payout day, oldest first. */
  lateMonths: string[];
  venmoHandle: string | null;
  /** How the next payout goes out: to their bank through Stripe (connected and ready), else by Venmo. */
  payoutVia: "stripe" | "venmo";
  stripeStatus: ConnectStatus;
  method: string;
  ledger: LedgerLine[];
  payouts: PayoutRow[];
};

/** "2026-10" for a date, in UTC (payout months follow UTC, like the admin pages). */
export const utcMonth = (d: Date) => d.toISOString().slice(0, 7);

/** The payout due date for an earnings month: the 5th of the following month, UTC. */
export function payoutDateFor(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, PAYOUT_DAY_OF_MONTH)); // m is 1-based, so this is next month
}

/** Unpaid and more than LATE_AFTER_DAYS days past the payout day (the whole 5th counts as on time). */
export function isPayoutLate(month: string, now: Date = new Date()) {
  return now.getTime() >= payoutDateFor(month).getTime() + (1 + LATE_AFTER_DAYS) * DAY_MS;
}

export function monthLabel(month: string, style: "long" | "short" = "long") {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-US", { timeZone: "UTC", month: style, year: "numeric" });
}

export function venmoLabel(handle: string | null | undefined) {
  const h = (handle || "").trim().replace(/^@/, "");
  return h ? `Venmo @${h}` : "Venmo (add your handle)";
}

export const STRIPE_LABEL = "Bank via Stripe";

/** A paid month's method, from Payout.method ("stripe" | "venmo" | "manual"; older rows have none and were Venmo). */
function paidMethodLabel(method: string | null | undefined, handle: string | null | undefined) {
  if (method === "stripe") return STRIPE_LABEL;
  if (method === "manual") return "Paid by Artfinity";
  return venmoLabel(handle);
}

function cityOnly(address: string | null | undefined) {
  // "1 Main St, Brooklyn, NY 11216, US" -> "Brooklyn". Never the street.
  let p = String(address || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (p.length >= 3 && !/\d/.test(p[p.length - 1]) && /\d/.test(p[p.length - 2])) p = p.slice(0, -1);
  if (p.length < 2) return "";
  const city = p[p.length - 2];
  return /^\d/.test(city) ? "" : city;
}

/** Status of one sale on a given day. */
export function lineStatus(args: { date: Date; month: string; paidMonths: Set<string>; currentMonth: string; now: Date }): LedgerStatus {
  if (args.paidMonths.has(args.month)) return "paid";
  const cleared = args.date.getTime() + RETURN_WINDOW_DAYS * DAY_MS <= args.now.getTime();
  return cleared && args.month < args.currentMonth ? "available" : "pending";
}

/** Each sale's share per UTC month, for comparing with /api/admin/payouts/summary. */
export async function monthTotals(artistId: string) {
  const b = await getBalance(artistId);
  const out = new Map<string, number>();
  for (const l of b.ledger) out.set(l.payoutMonth, (out.get(l.payoutMonth) || 0) + l.shareCents);
  return out;
}

export async function getBalance(artistId: string, now: Date = new Date()): Promise<Balance> {
  const [artist, items, payoutRows] = await Promise.all([
    prisma.artist.findUnique({ where: { id: artistId }, select: { venmoHandle: true, stripeAccountId: true, stripePayoutsEnabled: true } }),
    prisma.orderItem.findMany({
      where: { artwork: { artistId }, order: { paymentStatus: "paid", kind: { not: "bulk" } } },
      select: {
        id: true, title: true, slug: true, size: true, frameChosen: true, quantity: true, unitPrice: true,
        lineTotal: true, imageUrl: true, artistSplit: true, qrCodeId: true,
        artwork: { select: { title: true, slug: true, imageUrl: true } },
        order: { select: { id: true, createdAt: true, email: true, shippingName: true, shippingAddress: true } },
      },
      orderBy: { order: { createdAt: "desc" } },
    }),
    prisma.payout.findMany({ where: { artistId }, select: { month: true, amountCents: true, paidAt: true, method: true } }),
  ]);

  // Scan attribution: name each code by the artist's label, else its venue, else its short code.
  const codeIds = Array.from(new Set(items.map((i) => i.qrCodeId).filter((x): x is string => !!x)));
  const codes = codeIds.length
    ? await prisma.qrCode.findMany({ where: { id: { in: codeIds } }, select: { id: true, code: true, label: true, venue: true } })
    : [];
  const codeName = new Map(codes.map((c) => [c.id, c.label?.trim() || c.venue?.trim() || `Code ${c.code}`]));
  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.order.id))));

  const currentMonth = utcMonth(now);
  const paid = new Map(payoutRows.filter((p) => p.paidAt).map((p) => [p.month, p]));
  const paidMonths = new Set(paid.keys());
  const stripeStatus: ConnectStatus = artist ? connectStatus(artist) : "not_connected";
  const payoutVia = stripeStatus === "ready" ? "stripe" : "venmo";
  const method = payoutVia === "stripe" ? STRIPE_LABEL : venmoLabel(artist?.venmoHandle);

  const ledger: LedgerLine[] = items.map((it) => {
    const date = it.order.createdAt;
    const quantity = it.quantity || 1;
    const grossCents = it.lineTotal ?? (it.unitPrice ?? 0) * quantity;
    const size = normalizeSize(it.size);
    const b = calcItemProfitCents({ lineTotal: grossCents, size, frameChosen: it.frameChosen, quantity, orderDate: date, artistSplit: it.artistSplit });
    const month = utcMonth(date);
    const name = (it.order.shippingName || "").trim();
    const refund = refunds.get(it.id);
    return {
      id: it.id,
      orderId: it.order.id,
      date: date.toISOString(),
      clearsAt: new Date(date.getTime() + RETURN_WINDOW_DAYS * DAY_MS).toISOString(),
      title: it.artwork?.title || it.title || "Untitled",
      slug: it.artwork?.slug || it.slug,
      imageUrl: it.artwork?.imageUrl || it.imageUrl,
      size,
      framed: it.frameChosen,
      quantity,
      buyerFirst: name ? name.split(/\s+/)[0] : "Buyer",
      buyerCity: cityOnly(it.order.shippingAddress),
      source: it.qrCodeId ? codeName.get(it.qrCodeId) || "QR code" : null,
      buyerKey: createHash("sha256").update(it.order.email.trim().toLowerCase()).digest("hex").slice(0, 12),
      grossCents,
      printingCents: b.itemCost + b.shippingCost,
      feesCents: b.websiteCost + b.laborCost,
      profitCents: b.profit,
      split: b.split,
      shareCents: shareAfterRefund(b.artistShare, refund),
      status: lineStatus({ date, month, paidMonths, currentMonth, now }),
      payoutMonth: month,
      refunded: refund ? (refund.reversed ? "reversed" : "kept") : null,
    };
  });

  let pendingCents = 0, availableCents = 0, thisMonthCents = 0, paidComputed = 0;
  const byMonth = new Map<string, { cents: number; sales: number; prints: number }>();
  for (const l of ledger) {
    if (l.status === "pending") pendingCents += l.shareCents;
    else if (l.status === "available") availableCents += l.shareCents;
    else paidComputed += l.shareCents;
    if (l.payoutMonth === currentMonth) thisMonthCents += l.shareCents;
    const m = byMonth.get(l.payoutMonth) || { cents: 0, sales: 0, prints: 0 };
    m.cents += l.shareCents; m.sales += 1; m.prints += l.quantity;
    byMonth.set(l.payoutMonth, m);
  }
  // Paid months count at the amount actually recorded, even if today's recompute differs.
  const paidTotalCents = Array.from(paid.values()).reduce((n, p) => n + p.amountCents, 0);
  const adjustmentCents = paidTotalCents - paidComputed;
  const lifetimeCents = pendingCents + availableCents + paidTotalCents;

  // Next payout: every closed, unpaid month goes out in the next run on the 5th.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const nextRun = now.getUTCDate() <= PAYOUT_DAY_OF_MONTH
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), PAYOUT_DAY_OF_MONTH))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, PAYOUT_DAY_OF_MONTH));
  const owedMonths = Array.from(byMonth.keys()).filter((m) => m < currentMonth && !paidMonths.has(m) && byMonth.get(m)!.cents > 0).sort();
  let nextPayout: Balance["nextPayout"];
  if (owedMonths.length) {
    const latestDue = payoutDateFor(owedMonths[owedMonths.length - 1]);
    const late = latestDue.getTime() < today;
    const owed = new Set(owedMonths);
    const lines = ledger.filter((l) => owed.has(l.payoutMonth));
    nextPayout = {
      date: (late ? latestDue : nextRun).toISOString(),
      amountCents: lines.reduce((n, l) => n + l.shareCents, 0),
      months: owedMonths,
      clearingCents: lines.filter((l) => l.status === "pending").reduce((n, l) => n + l.shareCents, 0),
      projected: false,
      late,
    };
  } else {
    nextPayout = {
      date: payoutDateFor(currentMonth).toISOString(),
      amountCents: paidMonths.has(currentMonth) ? 0 : thisMonthCents,
      months: [currentMonth],
      clearingCents: paidMonths.has(currentMonth) ? 0 : thisMonthCents,
      projected: true,
      late: false,
    };
  }

  const lateMonths = owedMonths.filter((m) => isPayoutLate(m, now));

  const months = Array.from(new Set([...Array.from(byMonth.keys()), ...Array.from(paid.keys())])).sort((a, b) => b.localeCompare(a));
  const payouts: PayoutRow[] = months.map((m) => {
    const agg = byMonth.get(m) || { cents: 0, sales: 0, prints: 0 };
    const p = paid.get(m);
    const status: PayoutStatus = p ? "paid" : m < currentMonth ? "scheduled" : "in_progress";
    return {
      month: m,
      label: monthLabel(m),
      amountCents: p ? p.amountCents : agg.cents,
      computedCents: agg.cents,
      status,
      paidAt: p?.paidAt ? p.paidAt.toISOString() : null,
      // Every closed, unpaid month is in the next payout run.
      dueDate: status === "scheduled" ? nextPayout.date : payoutDateFor(m).toISOString(),
      method: p ? paidMethodLabel(p.method, artist?.venmoHandle) : method,
      sales: agg.sales,
      prints: agg.prints,
    };
  });

  return {
    now: now.toISOString(),
    currentMonth,
    pendingCents,
    availableCents,
    thisMonthCents,
    paidTotalCents,
    lifetimeCents,
    adjustmentCents,
    nextPayout,
    lateMonths,
    venmoHandle: artist?.venmoHandle?.trim() || null,
    payoutVia,
    stripeStatus,
    method,
    ledger,
    payouts,
  };
}

/**
 * Every artist with a late payout: a closed month with paid sales, not marked paid, more than
 * LATE_AFTER_DAYS past its payout day. Closed accounts included (they are still owed).
 */
export async function latePayouts(now: Date = new Date()): Promise<{ artistId: string; month: string }[]> {
  const rows = await prisma.$queryRaw<{ artistId: string; month: string }[]>`
    SELECT DISTINCT a."artistId" AS "artistId", to_char(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS month
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Artwork" a ON a.id = oi."artworkId"
    WHERE o."paymentStatus" = 'paid' AND o.kind <> 'bulk'
      AND o."createdAt" < ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))}`;
  const late = rows.filter((r) => isPayoutLate(r.month, now));
  if (!late.length) return [];
  const paid = await prisma.payout.findMany({
    where: { artistId: { in: Array.from(new Set(late.map((r) => r.artistId))) }, paidAt: { not: null } },
    select: { artistId: true, month: true },
  });
  const done = new Set(paid.map((p) => `${p.artistId}:${p.month}`));
  return late.filter((r) => !done.has(`${r.artistId}:${r.month}`)).sort((a, b) => a.month.localeCompare(b.month));
}
