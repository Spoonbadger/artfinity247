import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import MonthPicker from "../_components/MonthPicker";
import PayoutsTable from "../_components/PayoutsTable";
import PayAllPanel from "../_components/PayAllPanel";
import { currentMonth, monthLabel, monthRange } from "../_components/util";
import { latePayouts } from "@/lib/balance";

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

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{monthLabel(month)}</p>
          <h1 className="display text-[44px] sm:text-[56px]">Payouts</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <MonthPicker months={months} value={month} allowAll={false} />
          <a href={`/api/admin/payouts?month=${month}`} className="btn btn-ghost btn-sm mb-1">Export CSV</a>
        </div>
      </div>
      {lateByMonth.size > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 border-coral bg-[#fff1ed] px-4 py-3 text-[14.5px]">
          <span className="rounded-full bg-coral px-2 py-px text-[11.5px] font-bold text-white">Late</span>
          <b>Unpaid more than 3 days past the 5th:</b>
          {Array.from(lateByMonth).map(([m, n]) => (
            <a key={m} href={`/admin/payouts?month=${m}`} className="font-semibold text-scan underline-offset-2 hover:underline">
              {monthLabel(m)} ({n} {n === 1 ? "artist" : "artists"})
            </a>
          ))}
        </div>
      )}
      <PayAllPanel />
      <PayoutsTable key={month} month={month} />
    </div>
  );
}
