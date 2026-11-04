import Link from "next/link";
import { BrushStroke } from "@/components/af/Brush";
import Medal, { MEDAL_PAINT } from "@/components/af/Medal";
import VerifiedBadge from "@/components/af/VerifiedBadge";
import { MEDALS, medalFor, nextMedal } from "@/lib/medals";
import type { Trust } from "@/lib/artistTrust";

type Status = "NONE" | "PENDING" | "VERIFIED" | "REJECTED";

const TOP = MEDALS[0].min; // gold
const ASC = [...MEDALS].reverse(); // bronze, silver, gold

/** Studio dashboard card: the current medal, a painted bar to Gold, and how many prints to the next one. */
export default function MedalProgress({ trust, verification }: { trust: Trust; verification: Status }) {
  const sold = trust.printsSold;
  const current = medalFor(sold);
  const next = nextMedal(sold);
  const pct = Math.min(100, (sold / TOP) * 100);
  const barColor = next ? MEDAL_PAINT[next.tier].base : MEDAL_PAINT.gold.base;

  return (
    <section className="af-card grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-5" aria-labelledby="medal-h">
      <div className="flex items-center gap-4 sm:block">
        {current ? <Medal tier={current.tier} size={72} /> : <Medal tier="bronze" size={72} locked />}
        <div className="sm:hidden">
          <MedalHeading id="medal-h-m" next={next} current={current?.label} />
        </div>
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="hidden sm:block">
          <MedalHeading id="medal-h" next={next} current={current?.label} />
        </div>

        {/* painted bar, 0 to 50 prints, with the three medals hung at their marks */}
        <div className="relative pb-10">
          <div className="relative h-[36px]" role="progressbar" aria-valuemin={0} aria-valuemax={TOP} aria-valuenow={Math.min(sold, TOP)} aria-label={`${sold} of ${TOP} prints to Gold`}>
            <BrushStroke className="absolute inset-0 h-full w-full" color="var(--af-gallery)" />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
              <BrushStroke className="h-full w-full" color={barColor} />
            </div>
          </div>
          {ASC.map((m) => {
            const left = (m.min / TOP) * 100;
            const earned = sold >= m.min;
            return (
              <span key={m.tier} className="absolute top-[34px] grid -translate-x-1/2 justify-items-center gap-0.5" style={{ left: `min(${left}%, calc(100% - 14px))` }}>
                <Medal tier={m.tier} size={22} locked={!earned} />
                <span className="num text-[11.5px] font-semibold text-ink-2">{m.min}</span>
              </span>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[13.5px]">
          <span className="text-ink-2">
            <b className="num text-ink">{sold.toLocaleString("en-US")}</b> {sold === 1 ? "print" : "prints"} sold, all time
            {!trust.showStats && current ? " · hidden on your page" : ""}
          </span>
          {verification === "VERIFIED" ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-scan">
              <VerifiedBadge size={18} verifiedAt={trust.verifiedAt} /> Verified
            </span>
          ) : (
            <Link href="/studio/verify" className="-my-2 inline-flex min-h-[44px] items-center font-bold text-scan">
              {verification === "PENDING" ? "Verification under review" : verification === "REJECTED" ? "Verification: try again" : "Get verified"}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function MedalHeading({ id, next, current }: { id: string; next: ReturnType<typeof nextMedal>; current?: string }) {
  return (
    <>
      <h2 id={id} className="display text-[28px] sm:text-[34px]">
        {next ? (
          <>
            <span className="num">{next.remaining}</span> more {next.remaining === 1 ? "print" : "prints"} to {next.label.replace(" seller", "")}
          </>
        ) : (
          "Gold seller"
        )}
      </h2>
      <p className="mt-1 text-[13.5px] text-ink-2">{!next ? "Top medal. Buyers see it next to your name." : current ? `${current} now. Buyers see it next to your name.` : "Medals show next to your name."}</p>
    </>
  );
}
