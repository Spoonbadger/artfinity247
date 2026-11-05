// Demo payouts: every month whose payout day has passed is marked paid on the 5th,
// so the Money page shows a normal history instead of late payouts.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function seedPayouts(prisma) {
  // Load the app's own payout math (TypeScript) with jiti, which ships with Tailwind.
  const require = createRequire(import.meta.url);
  const jiti = createRequire(require.resolve("tailwindcss"))("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
  const { monthTotals, payoutDateFor } = jiti(path.join(root, "lib/balance.ts"));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const artists = await prisma.artist.findMany({ where: { role: "USER" }, select: { id: true } });
  let n = 0;
  for (const a of artists) {
    const totals = await monthTotals(a.id);
    for (const [month, cents] of totals) {
      const due = payoutDateFor(month);
      if (due >= today || cents <= 0) continue;
      await prisma.payout.upsert({
        where: { artistId_month: { artistId: a.id, month } },
        create: { artistId: a.id, month, amountCents: cents, paidAt: new Date(due.getTime() + 15 * 3600_000) },
        update: {},
      });
      n++;
    }
  }
  console.log(`Seeded ${n} paid payouts`);
}
