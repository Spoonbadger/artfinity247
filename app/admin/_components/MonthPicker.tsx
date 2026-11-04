"use client";

import { usePathname, useRouter } from "next/navigation";
import { monthLabel } from "./util";

/** Month filter. Writes ?month=YYYY-MM (or "all") to the URL so the server page re-queries. */
export default function MonthPicker({ months, value, allowAll = true }: { months: string[]; value: string; allowAll?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const opts = allowAll ? ["all", ...months] : months;
  return (
    <label className="af-field min-w-[180px] py-1.5">
      <small>Month</small>
      <select
        value={value}
        onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
        className="cursor-pointer !text-[15px] font-semibold"
      >
        {opts.map((m) => (
          <option key={m} value={m}>{m === "all" ? "All months" : monthLabel(m)}</option>
        ))}
      </select>
    </label>
  );
}
