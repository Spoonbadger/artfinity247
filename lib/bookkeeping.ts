// Monthly books for the accountant: a CSV with the month's totals and one line per order. Server only.
// Emailed to the owners on the 1st (app/api/cron/bookkeeping) and downloadable from /admin/jobs
// (GET /api/admin/bookkeeping?month=YYYY-MM).
//
// Same math as the admin dashboard (app/admin/page.tsx): paid buyer orders (bulk and free reprints excluded), money
// per line from lib/sales.ts itemBreakdown, refunded lines left out of sales and profit. On top of that:
//   tax collected    Stripe total minus print prices (shipping is free), per paid order, bulk included
//   artist share     each line's artist share after refunds (lib/refunds.ts shareAfterRefund), what the month owes artists,
//                    less refund adjustments recorded this month (paid-out refunds taken off a later payout)
//   payouts sent     Payout rows paid during the month (any month's earnings)
//   reprint costs    print + shipping + labor + site cost of free reprints made this month
//   refunds          line totals refunded (recorded) during the month, ex-tax; refunds on older orders get their own line
// Months are UTC calendar months, like /admin/orders and the payout CSV.
import { prisma } from "@/lib/prisma";
import { itemBreakdown } from "@/lib/sales";
import { activeRefunds, shareAfterRefund } from "@/lib/refunds";
import { calcItemProfitCents } from "@/lib/revenue";
import { normalizeSize } from "@/lib/sales";

export type BookTotals = {
  grossSalesCents: number;
  taxCents: number;
  profitCents: number;
  artistShareCents: number;
  payoutsSentCents: number;
  reprintCostCents: number;
  refundsCents: number;
  orders: number;
  prints: number;
  bulkCents: number;
};

export type BookLine = {
  date: Date;
  orderId: string;
  kind: "retail" | "bulk" | "reprint" | "refund";
  email: string;
  prints: number;
  salesCents: number;
  taxCents: number;
  chargedCents: number;
  costCents: number;
  artistShareCents: number;
  profitCents: number;
  refundedCents: number;
  note: string;
};

export type Books = { month: string | null; start: Date; end: Date; totals: BookTotals; lines: BookLine[] };

export function monthBounds(month: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)) };
}

/** "2026-10" for a date in November 2026. */
export const previousMonth = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);

const expensesOf = (it: { printCost: number | null; shippingCost: number | null; laborCost: number | null; websiteCost: number | null; size: string | null; frameChosen: boolean; quantity: number | null }, orderDate: Date) => {
  if (it.printCost != null || it.shippingCost != null) return (it.printCost ?? 0) + (it.shippingCost ?? 0) + (it.laborCost ?? 0) + (it.websiteCost ?? 0);
  const b = calcItemProfitCents({ lineTotal: 0, size: normalizeSize(it.size), frameChosen: it.frameChosen, quantity: it.quantity || 1, orderDate });
  return b.printCost + b.shippingCost + b.laborCost + b.websiteCost;
};

export async function buildBooks(range: { start: Date; end: Date }, month: string | null = null): Promise<Books> {
  const { start, end } = range;
  const itemSelect = {
    id: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true,
    printCost: true, shippingCost: true, laborCost: true, websiteCost: true,
  } as const;
  const [orders, payouts, allRefunds] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start, lt: end }, OR: [{ paymentStatus: "paid" }, { kind: "reprint" }] },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, kind: true, email: true, amountTotal: true, paymentStatus: true, items: { select: itemSelect } },
    }),
    prisma.payout.findMany({ where: { paidAt: { gte: start, lt: end } }, select: { amountCents: true } }),
    activeRefunds(),
  ]);
  const refundsInRange = Array.from(allRefunds.values()).filter((r) => r.at >= start && r.at < end);
  const refundedByOrder = new Map<string, number>();
  for (const r of refundsInRange) refundedByOrder.set(r.orderId, (refundedByOrder.get(r.orderId) ?? 0) + r.amountCents);

  const totals: BookTotals = { grossSalesCents: 0, taxCents: 0, profitCents: 0, artistShareCents: 0, payoutsSentCents: 0, reprintCostCents: 0, refundsCents: 0, orders: 0, prints: 0, bulkCents: 0 };
  const lines: BookLine[] = [];
  const seen = new Set<string>();

  for (const o of orders) {
    seen.add(o.id);
    const line: BookLine = { date: o.createdAt, orderId: o.id, kind: o.kind === "bulk" ? "bulk" : o.kind === "reprint" ? "reprint" : "retail", email: o.email, prints: 0, salesCents: 0, taxCents: 0, chargedCents: 0, costCents: 0, artistShareCents: 0, profitCents: 0, refundedCents: refundedByOrder.get(o.id) ?? 0, note: "" };
    if (line.kind === "reprint") {
      line.prints = o.items.reduce((n, i) => n + (i.quantity || 1), 0);
      line.costCents = o.items.reduce((n, i) => n + expensesOf(i, o.createdAt), 0);
      line.note = "Free reprint (no charge)";
      totals.reprintCostCents += line.costCents;
    } else {
      const priced = o.items.map((i) => ({ i, b: itemBreakdown({ ...i, orderDate: o.createdAt }) }));
      const allLines = priced.reduce((n, p) => n + p.b.lineTotal, 0);
      line.chargedCents = o.amountTotal;
      line.taxCents = Math.max(0, o.amountTotal - allLines);
      totals.taxCents += line.taxCents;
      if (line.kind === "bulk") {
        line.salesCents = allLines;
        line.prints = priced.reduce((n, p) => n + p.b.quantity, 0);
        line.costCents = priced.reduce((n, p) => n + p.b.expenses, 0);
        line.note = "Artist's own prints at cost (not in sales)";
        totals.bulkCents += allLines;
      } else {
        let counted = false;
        for (const { i, b } of priced) {
          const r = allRefunds.get(i.id);
          line.artistShareCents += shareAfterRefund(b.artistShare, r);
          if (r) continue; // dashboard: refunded lines are left out of sales and profit
          counted = true;
          line.salesCents += b.lineTotal;
          line.profitCents += b.companyShare;
          line.prints += b.quantity;
          line.costCents += b.expenses;
        }
        if (priced.some(({ i }) => allRefunds.has(i.id))) line.note = "Refunded line(s) left out of sales";
        totals.grossSalesCents += line.salesCents;
        totals.profitCents += line.profitCents;
        totals.prints += line.prints;
        totals.artistShareCents += line.artistShareCents;
        if (counted) totals.orders++;
      }
    }
    totals.refundsCents += line.refundedCents;
    lines.push(line);
  }

  // Refunds recorded this month on orders from earlier months.
  const older = Array.from(refundedByOrder).filter(([id]) => !seen.has(id));
  if (older.length) {
    const rows = await prisma.order.findMany({ where: { id: { in: older.map(([id]) => id) } }, select: { id: true, createdAt: true, email: true } });
    for (const o of rows) {
      const cents = refundedByOrder.get(o.id) ?? 0;
      totals.refundsCents += cents;
      lines.push({ date: o.createdAt, orderId: o.id, kind: "refund", email: o.email, prints: 0, salesCents: 0, taxCents: 0, chargedCents: 0, costCents: 0, artistShareCents: 0, profitCents: 0, refundedCents: cents, note: "Refund recorded this month on an earlier order" });
    }
  }
  // Refund adjustments recorded this month (lib/refundPolicy.ts "deduct_next_payout") lower what artists are owed.
  const deductByOrder = new Map<string, number>();
  for (const r of refundsInRange) if (r.deducted) deductByOrder.set(r.orderId, (deductByOrder.get(r.orderId) ?? 0) + r.shareCents);
  for (const line of lines) {
    const d = deductByOrder.get(line.orderId);
    if (!d) continue;
    line.artistShareCents -= d;
    totals.artistShareCents -= d;
    line.note = [line.note, `Refund adjustment: artist share -${usd(d)} taken off their next payout`].filter(Boolean).join("; ");
    deductByOrder.delete(line.orderId);
  }
  totals.payoutsSentCents = payouts.reduce((n, p) => n + p.amountCents, 0);
  return { month, start, end, totals, lines };
}

const usd = (c: number) => (c / 100).toFixed(2);
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const SUMMARY_ROWS: { key: keyof BookTotals; label: string; money: boolean }[] = [
  { key: "grossSalesCents", label: "Gross sales (print prices, paid buyer orders, refunded lines excluded)", money: true },
  { key: "taxCents", label: "Sales tax collected", money: true },
  { key: "profitCents", label: "Artfinity profit", money: true },
  { key: "artistShareCents", label: "Artist share earned (owed to artists)", money: true },
  { key: "payoutsSentCents", label: "Artist payouts sent this month", money: true },
  { key: "reprintCostCents", label: "Reprint costs", money: true },
  { key: "refundsCents", label: "Refunds (recorded this month, ex-tax)", money: true },
  { key: "orders", label: "Orders", money: false },
  { key: "prints", label: "Prints sold", money: false },
  { key: "bulkCents", label: "Artist bulk orders at cost (not in sales)", money: true },
];

export function booksCsv(b: Books): string {
  const label = b.month ?? `${b.start.toISOString().slice(0, 10)} to ${b.end.toISOString().slice(0, 10)}`;
  const rows: (string | number)[][] = [
    ["Artfinity books", label],
    ["Period (UTC)", b.start.toISOString().slice(0, 10), `to ${b.end.toISOString().slice(0, 10)} (exclusive)`],
    [],
    ["Summary", "USD"],
    ...SUMMARY_ROWS.map((r) => [r.label, r.money ? usd(b.totals[r.key]) : b.totals[r.key]]),
    [],
    ["date", "order", "kind", "buyer_email", "prints", "sales", "tax", "charged", "costs", "artist_share", "artfinity_profit", "refunded", "notes"],
    ...b.lines.map((l) => [
      l.date.toISOString().slice(0, 10), l.orderId, l.kind, l.email, l.prints, usd(l.salesCents), usd(l.taxCents), usd(l.chargedCents),
      usd(l.costCents), usd(l.artistShareCents), usd(l.profitCents), usd(l.refundedCents), l.note,
    ]),
  ];
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
