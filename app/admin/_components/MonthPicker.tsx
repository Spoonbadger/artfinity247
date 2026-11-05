"use client";

import { usePathname, useRouter } from "next/navigation";
import { monthLabel } from "./util";

/** Month filter. Writes ?month=YYYY-MM (or "all") to the URL so the server page re-queries. */
export default function MonthPicker({ months, value, allowAll = true }: { months: string[]; value: string; allowAll?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const opts = allowAll ? ["all", ...months] : months;
  return (
    <label className="af-field min-w-[170px] border-[1.5px] py-1">
      <small>Month</small>
      <select
        value={value}
        onChange={(e) => router.push(`${pathname}?month=${e.target.value}`)}
        className="cursor-pointer py-1 !text-[16px] font-semibold md:py-0 md:!text-[15px]"
      >
        {opts.map((m) => (
          <option key={m} value={m}>{m === "all" ? "All months" : monthLabel(m)}</option>
        ))}
      </select>
    </label>
  );
}
