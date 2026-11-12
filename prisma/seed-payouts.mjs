// Demo payouts. Payouts are Stripe-only now (lib/payouts.ts):
//   - Connect-ready seed artists (simulated "acct_sim_" accounts): every month whose payout day has passed is paid by a
//     simulated Stripe transfer on the 5th (method "stripe", a "tr_sim_" transfer id).
//   - Everyone else: months paid before Nov 2026 are history from before Stripe-only payouts (no method, shown as
//     "Paid outside Stripe (before Nov 2026)"); later months stay unpaid, held until they connect Stripe.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Payouts before this were made outside Stripe. */
const STRIPE_ONLY_FROM = new Date(Date.UTC(2026, 10, 1));

export async function seedPayouts(prisma) {
  // Load the app's own payout math (TypeScript) with jiti, which ships with Tailwind.
  const require = createRequire(import.meta.url);
  const jiti = createRequire(require.resolve("tailwindcss"))("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
  const { monthTotals, payoutDateFor } = jiti(path.join(root, "lib/balance.ts"));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const artists = await prisma.artist.findMany({ where: { role: "USER" }, select: { id: true, stripeAccountId: true, stripePayoutsEnabled: true } });
  let n = 0, held = 0;
  for (const a of artists) {
    const connected = !!a.stripeAccountId?.startsWith("acct_sim_") && a.stripePayoutsEnabled;
    const totals = await monthTotals(a.id);
    for (const [month, cents] of totals) {
      const due = payoutDateFor(month);
      if (due >= today || cents <= 0) continue;
      const paidAt = new Date(due.getTime() + 15 * 3600_000);
      if (!connected && paidAt >= STRIPE_ONLY_FROM) { held++; continue; }
      const stripe = connected ? { method: "stripe", stripeTransferId: `tr_sim_${randomBytes(8).toString("hex")}` } : {};
      await prisma.payout.upsert({
        where: { artistId_month: { artistId: a.id, month } },
        create: { artistId: a.id, month, amountCents: cents, paidAt, ...stripe },
        update: {},
      });
      n++;
    }
  }
  console.log(`Seeded ${n} paid payouts (${held} months held until Stripe is connected)`);
}
