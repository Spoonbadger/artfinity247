// Independence milestones (/admin/milestones): the live numbers behind each card. Server only, read-only.
//
// Reuses the site's own math and never writes business data:
//   profit        same as the admin dashboard (app/admin/page.tsx): paid buyer orders, no bulk, refunded lines out,
//                 lib/sales.ts itemBreakdown companyShare
//   lab cost      lib/revenue.ts COSTS.ITEM (the site's cost table, not the lab's live price list)
//   balances      lib/balance.ts getBalance; who gets paid how: lib/payouts.ts readyPayouts, lib/stripeConnect.ts
//   print lab     lib/printer.ts activeProvider and the order's printerSentAt / sentToPrinter
//   manual queues the same filters as the dashboard's "Needs you now" list
// The owner's numbers live in the admin settings snapshot (lib/adminSettings.ts `milestones`).
import { prisma } from "@/lib/prisma";
import { COSTS, type PrintSize } from "@/lib/revenue";
import { itemBreakdown, normalizeSize } from "@/lib/sales";
import { activeRefunds } from "@/lib/refunds";
import { getBalance, latePayouts } from "@/lib/balance";
import { readyPayouts } from "@/lib/payouts";
import { connectMode, connectStatus, type ConnectMode } from "@/lib/stripeConnect";
import { activeProvider } from "@/lib/printer";
import { readAdminSettings } from "@/lib/adminSettings";
import { cleanInputs, type MilestoneInputs } from "@/lib/milestonesCalc";
import { monthBounds, previousMonth } from "@/lib/bookkeeping";
import { openRequestCount } from "@/lib/reprints";
import { shippedDates } from "@/lib/shipping/store";
import { DUPLICATE_PREFIX } from "@/lib/imageHash";
import { openAlerts } from "@/lib/alerts";
import { integrationsHealth } from "@/lib/integrations";
import { PAINTING_SCANS } from "@/lib/features";

const DAY = 86_400_000;
const SIZES: PrintSize[] = ["S", "M", "L", "XL"];
const set = (k: string) => !!process.env[k]?.trim();

export type SizeMix = Record<PrintSize, number>;
const emptyMix = (): SizeMix => ({ S: 0, M: 0, L: 0, XL: 0 });

/** Company profit (cents) from paid buyer orders in [start, end): the dashboard's math. */
async function profitBetween(start: Date, end: Date) {
  const items = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: start, lt: end } } },
    select: { id: true, orderId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, order: { select: { createdAt: true } } },
  });
  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.orderId))));
  return items.filter((i) => !refunds.has(i.id)).reduce((n, i) => n + itemBreakdown({ ...i, orderDate: i.order.createdAt }).companyShare, 0);
}

export type ProviderInfo = { id: string; label: string; prodigi: boolean; detail: string | null };

/** The print lab provider in use, named for people. Reads lib/printer.ts activeProvider (never edits it). */
export function providerInfo(): ProviderInfo {
  const p = activeProvider();
  const id = p ? String(p.id) : "none";
  const prodigi = /prodigi/i.test(id) || /prodigi/i.test(process.env.PRINTER_PROVIDER || "");
  if (prodigi) return { id, label: "Prodigi API", prodigi, detail: set("PRODIGI_API_KEY") ? "PRODIGI_API_KEY set" : "PRODIGI_API_KEY missing" };
  if (id === "email") return { id, label: "Email to the lab", prodigi, detail: set("PRINTER_EMAIL") ? "PRINTER_EMAIL set" : "PRINTER_EMAIL not set: work orders only go to the server log" };
  if (id === "none") return { id, label: "None: sent by hand", prodigi, detail: null };
  return { id, label: `API (${id})`, prodigi, detail: null };
}

export type ManualTask = {
  key: string;
  label: string;
  n: number;
  href: string;
  /** auto: already runs by itself. key / setting / code: can be automated that way. person: needs a human. */
  can: "auto" | "key" | "setting" | "code" | "person";
  how: string;
};

export async function loadMilestones(now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);
  const since90 = new Date(now.getTime() - 90 * DAY);
  const settings = await readAdminSettings();
  const inputs: MilestoneInputs = cleanInputs(settings.milestones);
  const mode: ConnectMode = connectMode();

  // ---------- 1. Automatic payouts ----------
  const sellers = await prisma.$queryRaw<{ artistId: string }[]>`
    SELECT DISTINCT a."artistId" AS "artistId"
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Artwork" a ON a.id = oi."artworkId"
    WHERE o."paymentStatus" = 'paid' AND o.kind <> 'bulk'`;
  const owed = { total: 0, ready: 0, pending: 0, venmo: 0, cents: 0 };
  let stripeUnfinished = 0;
  for (const { artistId } of sellers) {
    const b = await getBalance(artistId, now);
    const cents = b.pendingCents + b.availableCents;
    if (cents <= 0) continue;
    owed.total++;
    owed.cents += cents;
    if (b.stripeStatus === "ready") owed.ready++;
    else if (b.stripeStatus === "pending") { owed.pending++; stripeUnfinished++; }
    else owed.venmo++;
  }
  // $0 months a refund adjustment used up ("carried") aren't payouts. Older rows have no method (SQL NULL), so say so.
  const sentPayout = { paidAt: { not: null }, OR: [{ method: null }, { method: { not: "carried" } }] };
  const lastPaid = await prisma.payout.findFirst({ where: sentPayout, orderBy: { month: "desc" }, select: { month: true } });
  const lastRows = lastPaid ? await prisma.payout.findMany({ where: { month: lastPaid.month, ...sentPayout }, select: { method: true, amountCents: true } }) : [];
  // Older rows have no method and were Venmo (lib/balance.ts); "manual" is by hand too.
  const lastByMethod = {
    stripe: { n: 0, cents: 0 },
    venmo: { n: 0, cents: 0 },
  };
  for (const r of lastRows) {
    const k = r.method === "stripe" ? "stripe" : "venmo";
    lastByMethod[k].n++;
    lastByMethod[k].cents += r.amountCents;
  }
  const ready = await readyPayouts(now);
  const payouts = {
    mode,
    stripeKey: set("STRIPE_SECRET_KEY"),
    connectWebhook: set("STRIPE_CONNECT_WEBHOOK_SECRET"),
    owed,
    lastMonth: lastPaid?.month ?? null,
    lastByMethod,
    venmoReady: ready.filter((r) => r.route === "venmo").length,
  };

  // ---------- 2. Orders go to the lab ----------
  const recent = await prisma.order.findMany({
    where: { paymentStatus: "paid", createdAt: { gte: since30 } },
    select: { printerSentAt: true, sentToPrinter: true, printerRef: true },
  });
  const lab = {
    provider: providerInfo(),
    orders: recent.length,
    auto: recent.filter((o) => o.printerSentAt).length,
    byHand: recent.filter((o) => !o.printerSentAt && o.sentToPrinter).length,
    notSent: recent.filter((o) => !o.printerSentAt && !o.sentToPrinter).length,
    failed: recent.filter((o) => o.printerRef?.startsWith("failed")).length,
  };

  // ---------- 3 and 4. Print volume and the lab's cost ----------
  // Every print the lab made: paid orders (bulk included) and free reprints.
  const printed = await prisma.orderItem.findMany({
    where: { order: { createdAt: { gte: since90 }, OR: [{ paymentStatus: "paid" }, { kind: "reprint" }] } },
    select: { size: true, frameChosen: true, quantity: true, order: { select: { createdAt: true } } },
  });
  const vol = { p30: 0, prev30: 0, p90: 0, unframed30: 0, unframedPrev30: 0, framed90: 0, labCost30: 0 };
  const unframedMix = emptyMix();
  for (const it of printed) {
    const q = it.quantity || 1;
    const size = normalizeSize(it.size);
    const at = it.order.createdAt;
    vol.p90 += q;
    if (it.frameChosen) vol.framed90 += q;
    else unframedMix[size] += q;
    if (at >= since30) {
      vol.p30 += q;
      vol.labCost30 += q * (it.frameChosen ? COSTS.ITEM.FRAMED[size] : COSTS.ITEM.UNFRAMED[size]);
      if (!it.frameChosen) vol.unframed30 += q;
    } else if (at >= since60) {
      vol.prev30 += q;
      if (!it.frameChosen) vol.unframedPrev30 += q;
    }
  }
  const unframed90 = SIZES.reduce((n, s) => n + unframedMix[s], 0);
  // Weighted by the last 90 days' unframed sizes; with none sold, the plain average of the table (said on the page).
  const labCostCents = unframed90
    ? Math.round(SIZES.reduce((n, s) => n + unframedMix[s] * COSTS.ITEM.UNFRAMED[s], 0) / unframed90)
    : Math.round(SIZES.reduce((n, s) => n + COSTS.ITEM.UNFRAMED[s], 0) / SIZES.length);
  const volume = { ...vol, avg90: Math.round((vol.p90 / 3) * 10) / 10, unframed90, unframedMix, labCostCents, labCostWeighted: unframed90 > 0 };

  // ---------- 5. Pays for itself ----------
  const lastMonth = previousMonth(now);
  const lm = monthBounds(lastMonth)!;
  const [profit30, profitLastMonth] = await Promise.all([profitBetween(since30, now), profitBetween(lm.start, lm.end)]);
  const profit = { profit30, lastMonth, profitLastMonth };

  // ---------- Still needs a person ----------
  // Same filters as the dashboard's "Needs you now" (app/admin/page.tsx).
  const notSentWhere = { OR: [{ paymentStatus: "paid" }, { kind: "reprint" }], shippingStatus: "pending", sentToPrinter: false, printerSentAt: null };
  const [pendingArt, duplicates, openReports, flaggedReviews, reprints, notSent, failedWo, shippedOrders, late, toVerify, codeOrders, scanBookings, socialDrafts] = await Promise.all([
    prisma.artwork.count({ where: { status: "PENDING", NOT: { flaggedReason: { startsWith: DUPLICATE_PREFIX } } } }),
    prisma.artwork.count({ where: { flaggedReason: { startsWith: DUPLICATE_PREFIX }, status: { not: "REJECTED" } } }),
    prisma.artReport.count({ where: { status: "open" } }),
    prisma.review.count({ where: { status: "flagged" } }),
    openRequestCount(),
    prisma.order.count({ where: notSentWhere }),
    prisma.order.count({ where: { printerRef: { startsWith: "failed" }, shippingStatus: "pending" } }),
    prisma.order.findMany({ where: { shippingStatus: "shipped" }, select: { id: true, createdAt: true } }),
    latePayouts(now),
    prisma.artist.count({ where: { verification: "PENDING" } }),
    prisma.codePrintOrder.count({ where: { status: "paid" } }).catch(() => 0),
    prisma.scanBooking.count({ where: { status: "requested" } }).catch(() => 0),
    prisma.socialPost.count({ where: { status: "draft" } }).catch(() => 0),
  ]);
  const shippedAt = await shippedDates(shippedOrders.map((o) => o.id));
  const staleShipped = shippedOrders.filter((o) => (shippedAt.get(o.id) ?? o.createdAt).getTime() < now.getTime() - 10 * DAY).length;
  const alerts = await openAlerts().catch(() => []);
  const COVERED = new Set(["report", "reprint", "duplicate", "moderation", "review_flagged", "verification", "work_order_failed", "order_stuck", "order_undelivered", "payout_late", "code_print_order", "scan_booking"]);
  const otherAlerts = alerts.filter((a) => a.severity === "urgent" || !COVERED.has(a.kind)).length;
  const health = new Map(integrationsHealth().map((h) => [h.id, h]));
  const imageCheckOn = health.get("image-check")?.status === "green";
  const instagramOn = health.get("instagram")?.status === "green";
  const trackingOn = set("SHIPPO_API_KEY") || set("EASYPOST_API_KEY");
  const labAuto = lab.provider.id !== "none";
  const lateArtists = new Set(late.map((l) => l.artistId)).size;

  const tasks: ManualTask[] = [
    { key: "print", label: "Orders not sent to the lab", n: notSent, href: "/admin/orders?month=all&filter=print", ...(labAuto ? { can: "auto" as const, how: `Sent by itself (${lab.provider.label}). Left here only if a send didn't happen.` } : { can: "key" as const, how: "Set PRINTER_EMAIL, or the Prodigi API key." }) },
    { key: "wo", label: "Work orders that failed", n: failedWo, href: "/admin/orders?month=all&filter=print", can: "auto", how: "Retried every hour. A person only if it keeps failing." },
    { key: "venmo", label: "Venmo payouts", n: payouts.venmoReady, href: "/admin/payouts", can: "setting", how: "Artists connect Stripe in Studio → Money. Then the 5th pays them." },
    { key: "late", label: "Late payouts", n: lateArtists, href: "/admin/payouts", can: "setting", how: "Same fix: Stripe-connected artists are paid on the 5th by the cron." },
    { key: "stripe", label: "Owed money, Stripe not finished", n: stripeUnfinished, href: "/admin/artists?stripe=pending&balance=1", can: "person", how: "The artist finishes Stripe. We can only nudge." },
    { key: "shipped", label: "Shipped 10+ days, not delivered", n: staleShipped, href: "/admin/orders?month=all&filter=shipped", ...(trackingOn ? { can: "auto" as const, how: "Tracking updates come in by themselves. Left here: a real delay." } : { can: "key" as const, how: "Set SHIPPO_API_KEY or EASYPOST_API_KEY: deliveries mark themselves." }) },
    { key: "mod", label: "Artworks to review", n: pendingArt, href: "/admin/moderation", ...(imageCheckOn ? { can: "person" as const, how: "The image check is on. What it holds needs a person." } : { can: "key" as const, how: "Partly: IMAGE_MODERATION_PROVIDER pre-screens uploads. Held ones need a person." }) },
    { key: "dupes", label: "Possible duplicates", n: duplicates, href: "/admin/moderation", can: "person", how: "Someone has to decide whose image it is." },
    { key: "verify", label: "Verification requests", n: toVerify, href: "/admin/verification", can: "person", how: "Checking the work is really theirs takes a person." },
    { key: "reports", label: "Reports (DMCA, AI, content)", n: openReports, href: "/admin/reports", can: "person", how: "Legal calls. Keep a person on these." },
    { key: "reviews", label: "Reviews held", n: flaggedReviews, href: "/admin/reviews", can: "person", how: "Held reviews are judgment calls." },
    { key: "reprints", label: "Reprint requests", n: reprints, href: "/admin/reprints", can: "code", how: "Needs a person to judge the photo. Auto-approve rules: a code change." },
    { key: "codes", label: "Code orders to print", n: codeOrders, href: "/admin/code-orders?status=paid", can: "code", how: "Printed and mailed by hand. Sending them to the lab: a code change." },
    ...(PAINTING_SCANS ? [{ key: "scans", label: "Scan bookings to confirm", n: scanBookings, href: "/admin/scanning", can: "person" as const, how: "Scans happen in person in NYC." }] : []),
    { key: "social", label: "Social posts to approve", n: socialDrafts, href: "/admin/social", can: instagramOn ? "person" : "key", how: instagramOn ? "Approved posts publish by themselves. Picking them is taste." : "Posting: add the Instagram keys (SOCIAL_SETUP.md). Picking needs a person." },
    { key: "alerts", label: "Other open alerts", n: otherAlerts, href: "/admin/alerts", can: "person", how: "Most clear by themselves once the cause is fixed." },
  ];

  return { now, inputs, payouts, lab, volume, profit, tasks };
}

export type MilestoneData = Awaited<ReturnType<typeof loadMilestones>>;
