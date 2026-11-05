import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import MonthPicker from "../_components/MonthPicker";
import PayoutsTable from "../_components/PayoutsTable";
import PayAllPanel from "../_components/PayAllPanel";
import { currentMonth, monthLabel, monthRange } from "../_components/util";
import { latePayouts } from "@/lib/balance";
import { PageHead } from "../_components/ui";
import { Problem } from "@/components/studio/Problem";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

export default async function AdminPayoutsPage({ searchParams }: { searchParams: { month?: string } }) {
  await adminOrRedirect("/admin/payouts");
  const monthRows = await prisma.$queryRaw<{ m: string }[]>`
    SELECT DISTINCT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS m FROM "Order" WHERE "paymentStatus" = 'paid' ORDER BY m DESC`;
  const months = Array.from(new Set([currentMonth(), ...monthRows.map((r) => r.m)])).sort().reverse();
  const month = searchParams.month && monthRange(searchParams.month) ? searchParams.month : monthRows[0]?.m ?? currentMonth();
  // Late payouts in any month, so they show even while another month is open.
  const late = await latePayouts();
  const lateByMonth = new Map<string, number>();
  for (const l of late) lateByMonth.set(l.month, (lateByMonth.get(l.month) || 0) + 1);

  const lateList = Array.from(lateByMonth);

  return (
    <div className="grid gap-5">
      <PageHead title="Payouts" sub="Paid by the 5th. Late after the 8th." />
      {lateList.length > 0 && (
        <Problem tone="error" title={`Late: ${lateList.map(([m, n]) => `${monthLabel(m)} (${n} ${n === 1 ? "artist" : "artists"})`).join(", ")}`} fix={{ label: "Open month", href: `/admin/payouts?month=${lateList[0][0]}` }} />
      )}
      <PayAllPanel />
      <section aria-labelledby="month-h" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="month-h" className="text-[20px] font-bold">By month</h2>
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker months={months} value={month} allowAll={false} />
            <a href={`/api/admin/payouts?month=${month}`} className="btn btn-ghost btn-sm">Export CSV</a>
          </div>
        </div>
        <PayoutsTable key={month} month={month} />
      </section>
    </div>
  );
}
