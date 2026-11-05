// "Your scan is confirmed — pay $X": shown at the top of every Studio page (except /studio/scanning itself) while a
// painting scan booking is confirmed and waiting for payment (lib/scanning.server.ts).
import Link from "next/link";
import { dayLabel, usd } from "@/lib/scanning";

export default function ScanPayBanner({ id, priceCents, date }: { id: string; priceCents: number; date: Date | null }) {
  return (
    <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-9">
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border-2 border-scan bg-scan-soft px-4 py-3 text-[14.5px] leading-relaxed">
        <p className="min-w-0 flex-1">
          <b className="text-[15.5px]">Your scan is confirmed — pay {usd(priceCents)}</b>{" "}
          {date ? <>for {dayLabel(date, { weekday: "long", month: "long", day: "numeric" })}. </> : null}Paying locks in the date.
        </p>
        <Link href={`/studio/scanning?booking=${id}`} className="btn btn-blue btn-sm min-h-[44px] md:min-h-0">Pay {usd(priceCents)}</Link>
      </div>
    </div>
  );
}
