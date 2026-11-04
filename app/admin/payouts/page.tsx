import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import MonthPicker from "../_components/MonthPicker";
import PayoutsTable from "../_components/PayoutsTable";
import { currentMonth, monthLabel, monthRange } from "../_components/util";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payouts" };

export default async function AdminPayoutsPage({ searchParams }: { searchParams: { month?: string } }) {
  await adminOrRedirect("/admin/payouts");
  const monthRows = await prisma.$queryRaw<{ m: string }[]>`
    SELECT DISTINCT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS m FROM "Order" WHERE "paymentStatus" = 'paid' ORDER BY m DESC`;
  const months = Array.from(new Set([currentMonth(), ...monthRows.map((r) => r.m)])).sort().reverse();
  const month = searchParams.month && monthRange(searchParams.month) ? searchParams.month : monthRows[0]?.m ?? currentMonth();

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
      <PayoutsTable key={month} month={month} />
    </div>
  );
}
