"use client";

import { useEffect, useRef, useState } from "react";

export type ScanDay = { key: string; label: string; n: number };

const PAD_L = 28, PAD_R = 6, PAD_T = 12, PAD_B = 24;
const BAR = "#8b2a4b"; // garnet (--af-scan): one series, so the card title names it

/** Scans per day. Hover or focus a bar for the day's count. */
export default function ScanChart({ days }: { days: ScanDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 170 : 210;
  const max = Math.max(2, ...days.map((d) => d.n));
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const ticks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, top / 2, top];
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const step = plotW / days.length;
  const barW = Math.max(2, step - (step > 8 ? 2 : 1));
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const h = hover !== null ? days[hover] : null;
  const total = days.reduce((s, d) => s + d.n, 0);

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Scans per day, last ${days.length} days. ${total} in all.`} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--af-line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--af-ink-2)" className="num">{t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD_L + i * step + (step - barW) / 2;
          const bh = d.n ? Math.max(2, y(0) - y(d.n)) : 0;
          const r = Math.min(4, barW / 2, bh);
          const yb = y(0);
          return (
            <g key={d.key}>
              {bh > 0 && (
                <path
                  d={`M${x},${yb} V${yb - bh + r} Q${x},${yb - bh} ${x + r},${yb - bh} H${x + barW - r} Q${x + barW},${yb - bh} ${x + barW},${yb - bh + r} V${yb} Z`}
                  fill={BAR}
                  opacity={hover === null || hover === i ? 1 : 0.5}
                />
              )}
              <rect
                x={PAD_L + i * step} y={PAD_T} width={step} height={plotH} fill="transparent"
                tabIndex={0} role="graphics-symbol" aria-label={`${d.label}: ${d.n} ${d.n === 1 ? "scan" : "scans"}`}
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
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] shadow-[0_4px_14px_rgba(21,22,27,.12)]"
          style={{ left: `${Math.min(88, Math.max(12, ((PAD_L + hover * step + step / 2) / W) * 100))}%` }}
        >
          <b className="num block text-[14px]">{h.n} {h.n === 1 ? "scan" : "scans"}</b>
          <span className="block text-ink-2">{h.label}</span>
        </div>
      )}
    </div>
  );
}
