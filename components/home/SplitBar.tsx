import { breakdown, money, SIZE_NAME, type SizeKey } from "@/lib/earnings";

const EDGE = ["48% 40% 52% 44% / 60% 50% 50% 40%", "40% 52% 44% 50% / 50% 60% 40% 50%"];

/** One print's price, painted as a bar: costs, then the profit split 60/40. */
export default function SplitBar({ size = "medium", markupCents = 0 }: { size?: SizeKey; markupCents?: number }) {
  const b = breakdown(size, markupCents, 0);
  const seg = [
    { label: "Printing and shipping", v: b.cost, color: "#cfc9bc", text: "text-ink" },
    { label: "Card fee and hosting", v: b.fee + b.hosting, color: "#a9a397", text: "text-ink" },
    { label: "Artfinity 40%", v: b.company, color: "var(--af-ink)", text: "text-white" },
    { label: "You 60%", v: b.artist, color: "var(--af-earned)", text: "text-white" },
  ];
  return (
    <figure className="af-card grid gap-5 p-5 shadow-[8px_8px_0_var(--af-ink)] sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-[15px] text-ink-2">One {SIZE_NAME[size]} print</figcaption>
        <b className="display num text-[40px]">{money(b.price)}</b>
      </div>
      <div className="flex h-14 w-full gap-[3px]" role="img" aria-label={seg.map((s) => `${s.label} ${money(s.v)}`).join(", ")}>
        {seg.map((s, i) => (
          <div key={s.label} className="relative h-full min-w-[10px]" style={{ flex: s.v, background: s.color, borderRadius: EDGE[i % 2], transform: `rotate(${i % 2 ? 0.6 : -0.6}deg)` }}>
            <span className="absolute inset-x-2 top-1/2 h-[2px] -translate-y-3 rounded bg-white/20" aria-hidden="true" />
          </div>
        ))}
      </div>
      <dl className="num grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
        {seg.map((s) => (
          <div key={s.label} className="grid gap-0.5">
            <dt className="flex items-center gap-2 text-ink-2"><span className="paint-dab h-3 w-3" style={{ ["--dab" as string]: s.color }} />{s.label}</dt>
            <dd className={s.label.startsWith("You") ? "font-display text-[26px] font-extrabold text-earned [font-variation-settings:'wdth'_80]" : "font-semibold"}>{money(s.v)}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
