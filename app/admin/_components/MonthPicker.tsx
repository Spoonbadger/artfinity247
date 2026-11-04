"use client";

import { usePathname, useRouter } from "next/navigation";

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

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
