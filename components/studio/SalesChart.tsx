"use client";

import { useState } from "react";

export type DayPoint = { key: string; label: string; prints: number; earnedCents: number };

const W = 560, H = 190, PAD_L = 26, PAD_R = 6, PAD_T = 12, PAD_B = 24;
const BAR = "#d0611f"; // cadmium, matches the "prints sold" chip

const money = (c: number) => "$" + (c / 100).toFixed(2);

/** Daily prints sold, last 30 days. One series, so no legend box: the card title names it. */
export default function SalesChart({ days }: { days: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(2, ...days.map((d) => d.prints));
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const ticks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, top / 2, top];
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const step = plotW / days.length;
  const barW = Math.max(4, step - 4);
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const h = hover !== null ? days[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Prints sold per day, last 30 days. ${days.reduce((s, d) => s + d.prints, 0)} in all.`} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--af-line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--af-ink-2)" className="num">{t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD_L + i * step + (step - barW) / 2;
          const bh = d.prints ? Math.max(3, y(0) - y(d.prints)) : 0;
          const r = Math.min(4, barW / 2, bh);
          const yb = y(0);
          return (
            <g key={d.key}>
              {bh > 0 && (
                <path
                  d={`M${x},${yb} V${yb - bh + r} Q${x},${yb - bh} ${x + r},${yb - bh} H${x + barW - r} Q${x + barW},${yb - bh} ${x + barW},${yb - bh + r} V${yb} Z`}
                  fill={BAR}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              <rect
                x={PAD_L + i * step} y={PAD_T} width={step} height={plotH} fill="transparent"
                tabIndex={0} role="graphics-symbol" aria-label={`${d.label}: ${d.prints} sold, ${money(d.earnedCents)} earned`}
                onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                className="cursor-default outline-none focus-visible:stroke-scan focus-visible:[stroke-width:2]"
              />
            </g>
          );
        })}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text key={i} x={PAD_L + i * step + step / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--af-ink-2)">
            {days[i]?.label}
          </text>
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] shadow-[0_4px_14px_rgba(21,22,27,.12)]"
          style={{ left: `${Math.min(88, Math.max(12, ((PAD_L + hover * step + step / 2) / W) * 100))}%` }}
        >
          <b className="num block text-[14px]">{h.prints} sold</b>
          {h.earnedCents > 0 && <span className="num block font-semibold text-earned">{money(h.earnedCents)} earned</span>}
          <span className="block text-ink-2">{h.label}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Prints sold per day</caption>
        <thead><tr><th>Day</th><th>Prints</th><th>Earned</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.prints}</td><td>{money(d.earnedCents)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
