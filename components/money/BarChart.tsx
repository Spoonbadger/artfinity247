"use client";

import { useEffect, useId, useRef, useState } from "react";
import { niceTicks, usd, usd0 } from "./format";

export type Series = { name: string; color: string; hatch?: boolean };
export type Bucket = { key: string; label: string; sub?: string; values: number[] };

const PAD_L = 46, PAD_R = 6, PAD_T = 12, PAD_B = 24;
const GAP = 2; // surface gap between stacked fills

/** Rounded-top bar path anchored to the baseline. */
function bar(x: number, yTop: number, w: number, yBase: number, r: number) {
  const h = yBase - yTop;
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${yBase} V${yTop + rr} Q${x},${yTop} ${x + rr},${yTop} H${x + w - rr} Q${x + w},${yTop} ${x + w},${yTop + rr} V${yBase} Z`;
}

/**
 * Bars drawn to scale in SVG (no chart library), one y-axis in dollars.
 * mode "stack": series stack bottom-up. mode "overlay": series[0] is a wide bar, series[1] a narrower
 * bar in front of it (used for gross vs your share, where share is part of gross).
 */
export default function BarChart({ buckets, series, mode = "stack", label }: { buckets: Bucket[]; series: Series[]; mode?: "stack" | "overlay"; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const hatchId = useId().replace(/:/g, "");
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = W < 480 ? 190 : 220;
  const totals = buckets.map((b) => (mode === "stack" ? b.values.reduce((n, v) => n + v, 0) : Math.max(...b.values)));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1];
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const step = plotW / Math.max(1, buckets.length);
  const barW = Math.max(4, Math.min(44, step * 0.68));
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;
  const labelEvery = Math.ceil(buckets.length / (W < 480 ? 4 : 7));
  const h = hover !== null ? buckets[hover] : null;

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#0f7a55" strokeWidth="1.6" opacity=".45" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--af-line)" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--af-ink-2)" className="num">{usd0(t)}</text>
          </g>
        ))}
        {buckets.map((b, i) => {
          const x0 = PAD_L + i * step + (step - barW) / 2;
          const dim = hover !== null && hover !== i ? 0.5 : 1;
          const marks: JSX.Element[] = [];
          if (mode === "stack") {
            let acc = 0;
            const lastIdx = b.values.reduce((li, v, k) => (v > 0 ? k : li), -1);
            b.values.forEach((v, k) => {
              if (v <= 0) return;
              const yb = y(acc) - (acc > 0 ? GAP : 0);
              acc += v;
              const yt = Math.min(yb - 1.5, y(acc));
              const s = series[k];
              const d = k === lastIdx ? bar(x0, yt, barW, yb, 4) : `M${x0},${yb} V${yt} H${x0 + barW} V${yb} Z`;
              marks.push(<path key={k} d={d} fill={s.color} opacity={dim} />);
              if (s.hatch) marks.push(<path key={`${k}h`} d={d} fill={`url(#${hatchId})`} opacity={dim} />);
            });
          } else {
            b.values.forEach((v, k) => {
              if (v <= 0) return;
              const w = k === 0 ? barW : barW * 0.5;
              const x = x0 + (barW - w) / 2;
              marks.push(<path key={k} d={bar(x, Math.min(y(0) - 1.5, y(v)), w, y(0), 4)} fill={series[k].color} opacity={dim} stroke={k > 0 ? "#fff" : undefined} strokeWidth={k > 0 ? 2 : undefined} paintOrder="stroke" />);
            });
          }
          const total = totals[i];
          return (
            <g key={b.key}>
              {marks}
              <rect
                x={PAD_L + i * step} y={PAD_T} width={step} height={plotH} fill="transparent"
                tabIndex={0} role="graphics-symbol"
                aria-label={`${b.label}: ${series.map((s, k) => `${s.name} ${usd(b.values[k])}`).join(", ")}${mode === "stack" ? `, total ${usd(total)}` : ""}`}
                onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                className="cursor-default outline-none focus-visible:stroke-scan focus-visible:[stroke-width:2]"
              />
            </g>
          );
        })}
        {buckets.map((b, i) =>
          (buckets.length - 1 - i) % labelEvery === 0 ? (
            <text key={b.key} x={PAD_L + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--af-ink-2)">{b.label}</text>
          ) : null
        )}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] shadow-[0_4px_14px_rgba(21,22,27,.12)]"
          style={{ left: `${Math.min(84, Math.max(16, ((PAD_L + hover * step + step / 2) / W) * 100))}%` }}
        >
          <b className="block text-[13px]">{h.sub || h.label}</b>
          {series.map((s, k) => (
            <span key={s.name} className="num flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-2"><i className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />{s.name}</span>
              <b>{usd(h.values[k])}</b>
            </span>
          ))}
          {mode === "stack" && series.length > 1 && (
            <span className="num mt-0.5 flex justify-between gap-4 border-t border-line pt-0.5"><span className="text-ink-2">Total</span><b>{usd(totals[hover])}</b></span>
          )}
        </div>
      )}
    </div>
  );
}

/** Legend row: swatch + name. Always shown for 2+ series. */
export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {series.map((s) => (
        <li key={s.name} className="flex items-center gap-1.5">
          <i
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ background: s.hatch ? `repeating-linear-gradient(45deg, ${s.color} 0 3px, #7fbfa2 3px 4.5px)` : s.color }}
            aria-hidden="true"
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}
