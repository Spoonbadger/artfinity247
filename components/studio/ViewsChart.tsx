"use client";

import { useEffect, useRef, useState } from "react";

export type ViewPoint = { key: string; label: string; views: number; visitors: number };

const PAD_L = 34, PAD_R = 8, PAD_T = 12, PAD_B = 24;
const LINE = "var(--af-scan)"; // garnet (--af-scan), matches the "views" chip

function niceTop(max: number) {
  if (max <= 4) return Math.max(2, max);
  const mag = Math.pow(10, Math.floor(Math.log10(max)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s * 4 >= max) ?? mag * 10;
  return Math.ceil(max / step) * step;
}

/** Page views per day. One series, so no legend: the card title names it. */
export default function ViewsChart({ days }: { days: ViewPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 180 : 220;
  const top = niceTop(Math.max(0, ...days.map((d) => d.views)));
  const ticks = [0, top / 2, top];
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const step = plotW / Math.max(1, days.length);
  const x = (i: number) => PAD_L + i * step + step / 2;
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const pts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.views).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${x(days.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const h = hover !== null ? days[hover] : null;
  const total = days.reduce((s, d) => s + d.views, 0);

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Page views per day, last ${days.length} days. ${total} in all.`} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--af-line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--af-ink-2)" className="num">{t.toLocaleString("en-US")}</text>
          </g>
        ))}
        <path d={area} fill="var(--af-scan-soft)" opacity={0.7} />
        <path d={line} fill="none" stroke={LINE} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {h && hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={y(0)} stroke="var(--af-ink-2)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.views)} r={4.5} fill="#fff" stroke={LINE} strokeWidth={2.25} />
          </>
        )}
        {days.map((d, i) => (
          <rect
            key={d.key} x={PAD_L + i * step} y={PAD_T} width={step} height={plotH} fill="transparent"
            tabIndex={0} role="graphics-symbol" aria-label={`${d.label}: ${d.views} views, ${d.visitors} visitors`}
            onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            className="cursor-default outline-none focus-visible:stroke-scan focus-visible:[stroke-width:2]"
          />
        ))}
        {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--af-ink-2)">
            {days[i]?.label}
          </text>
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] shadow-[0_4px_14px_rgba(21,22,27,.12)]"
          style={{ left: `${Math.min(88, Math.max(12, (x(hover) / W) * 100))}%` }}
        >
          <b className="num block text-[14px]">{h.views.toLocaleString("en-US")} {h.views === 1 ? "view" : "views"}</b>
          <span className="num block text-ink-2">{h.visitors.toLocaleString("en-US")} {h.visitors === 1 ? "visitor" : "visitors"}</span>
          <span className="block text-ink-2">{h.label}</span>
        </div>
      )}
      <div className="sr-only">
        <table>
          <caption>Page views per day</caption>
          <thead><tr><th>Day</th><th>Views</th><th>Visitors</th></tr></thead>
          <tbody>{days.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.views}</td><td>{d.visitors}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
