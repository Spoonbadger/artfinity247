"use client";

import { useEffect, useState } from "react";
import { breakdown, money, SIZE_NAME, type SizeKey } from "@/lib/earnings";
import PaintBar from "@/components/motion/PaintBar";
import { usePlay } from "@/components/motion/Stage";
import { useTween } from "@/components/motion/useTween";
import { cn } from "@/lib/utils";

const SIZES: SizeKey[] = ["small", "medium", "large", "xl"];

function Money({ cents, className }: { cents: number; className?: string }) {
  const v = useTween(cents);
  return <span className={className}>{money(Math.round(v))}</span>;
}

/**
 * Where one print's money goes, painted as a bar. While on screen it steps through the
 * sizes on its own (the bar and numbers glide); tapping a size takes over.
 * With reduced motion it stays on Medium.
 */
export default function SplitBar({ markupCents = 0 }: { markupCents?: number }) {
  const { ref, play } = usePlay<HTMLElement>({ threshold: 0.4 });
  const [size, setSize] = useState<SizeKey>("medium");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!play || !auto) return;
    const t = setInterval(() => setSize((s) => SIZES[(SIZES.indexOf(s) + 1) % SIZES.length]), 2600);
    return () => clearInterval(t);
  }, [play, auto]);

  const b = breakdown(size, markupCents, 0);
  const seg = [
    { label: "Printing and shipping", value: b.cost, color: "#cfc9bc" },
    { label: "Card fee and hosting", value: b.fee + b.hosting, color: "#a9a397" },
    { label: "Artfinity 40%", value: b.company, color: "var(--af-ink)" },
    { label: "You 60%", value: b.artist, color: "var(--af-earned)" },
  ];

  return (
    <figure ref={ref} className="af-card grid gap-5 p-5 shadow-[8px_8px_0_var(--af-ink)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Print size">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => { setAuto(false); setSize(s); }}
              className={cn("rounded-full border-[1.5px] px-3 py-1 text-[13px] font-semibold transition-colors", size === s ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}
            >
              {SIZE_NAME[s]}
            </button>
          ))}
        </div>
        <b className="display num text-[40px]" aria-hidden="true"><Money cents={b.price} /></b>
      </div>
      <figcaption className="sr-only" aria-live={auto ? "off" : "polite"}>{`One ${SIZE_NAME[size]} print, ${money(b.price)}: ${seg.map((s) => `${s.label} ${money(s.value)}`).join(", ")}.`}</figcaption>
      <PaintBar segs={seg} />
      <dl className="num grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]" aria-hidden="true">
        {seg.map((s) => (
          <div key={s.label} className="grid gap-0.5">
            <dt className="flex items-center gap-2 text-ink-2"><span className="paint-dab h-3 w-3" style={{ ["--dab" as string]: s.color }} />{s.label}</dt>
            <dd className={s.label.startsWith("You") ? "font-display text-[26px] font-extrabold text-earned [font-variation-settings:'wdth'_80]" : "font-semibold"}><Money cents={s.value} /></dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
