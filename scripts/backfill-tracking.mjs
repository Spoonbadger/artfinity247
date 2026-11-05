// One-off: copy tracking kept as Messages ("Shipped: USPS 9400…", the old lib/tracking.ts storage) into the Order
// tracking columns (trackingCarrier, trackingNumber, shippedAt) and set deliveredAt on delivered orders from the
// admin audit log. Dry run by default; safe to run again (orders that already have a tracking number are skipped).
//
//   node scripts/backfill-tracking.mjs           # show what would change
//   node scripts/backfill-tracking.mjs --apply   # do it
import { PrismaClient } from "@prisma/client";

try { process.loadEnvFile(); } catch {}
const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();
const PREFIX = "Shipped: ";

async function main() {
  const msgs = await prisma.message.findMany({
    where: { subject: { startsWith: PREFIX }, orderId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { orderId: true, subject: true, createdAt: true },
  });
  const byOrder = new Map();
  for (const m of msgs) {
    const hit = m.subject.slice(PREFIX.length).match(/^(USPS|UPS|FedEx|Other) (.+)$/);
    if (!hit) continue;
    const cur = byOrder.get(m.orderId) ?? { first: m.createdAt };
    byOrder.set(m.orderId, { ...cur, carrier: hit[1], number: hit[2] }); // newest number wins, first date is "shipped"
  }

  const orders = byOrder.size
    ? await prisma.order.findMany({ where: { id: { in: [...byOrder.keys()] } }, select: { id: true, trackingNumber: true, shippedAt: true } })
    : [];
  let tracking = 0;
  for (const o of orders) {
    if (o.trackingNumber) continue;
    const t = byOrder.get(o.id);
    tracking++;
    console.log(`${APPLY ? "set" : "would set"} ${o.id}: ${t.carrier} ${t.number}, shipped ${t.first.toISOString()}`);
    if (APPLY) await prisma.order.update({ where: { id: o.id }, data: { trackingCarrier: t.carrier, trackingNumber: t.number, shippedAt: o.shippedAt ?? t.first } });
  }

  // Delivered orders: the admin action that marked them delivered.
  const delivered = await prisma.order.findMany({ where: { shippingStatus: "delivered", deliveredAt: null }, select: { id: true } });
  let dates = 0;
  if (delivered.length) {
    const acts = await prisma.adminAction.findMany({
      where: { targetType: "order", targetId: { in: delivered.map((o) => o.id) }, action: { in: ["order.shipping_status", "order.ship"] } },
      orderBy: { createdAt: "asc" },
      select: { targetId: true, createdAt: true, details: true },
    });
    const at = new Map();
    for (const a of acts) if (a.details?.to === "delivered" && !at.has(a.targetId)) at.set(a.targetId, a.createdAt);
    for (const [id, when] of at) {
      dates++;
      console.log(`${APPLY ? "set" : "would set"} ${id}: delivered ${when.toISOString()}`);
      if (APPLY) await prisma.order.update({ where: { id }, data: { deliveredAt: when } });
    }
  }
  console.log(`${APPLY ? "Done" : "Dry run"}: ${tracking} orders with tracking, ${dates} delivered dates.${APPLY ? "" : " Add --apply to write."}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
