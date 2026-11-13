import { qrMatrix } from "@/lib/qr/render";
import s from "./motion.module.css";
import { cn } from "@/lib/utils";

const BANDS = 14;

function rr(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

/**
 * A real, scannable QR code whose modules are grouped into diagonal bands, so that inside a
 * playing <Stage/> it erases and redraws itself dot by dot in a sweep. At rest it is complete.
 * Dots are round, eyes are rounded squares (the same geometry lib/qr/render.ts scan-tests).
 */
export default function QRDraw({ value, fg = "#15161b", eyeColor = "#8b2a4b", loop = 7, sweep = 0.9, className, label }: { value: string; fg?: string; eyeColor?: string; loop?: number; sweep?: number; className?: string; label?: string }) {
  const m = qrMatrix(value);
  const n = m.length, q = 2, V = n + q * 2;
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const align = (r: number, c: number) => n >= 25 && n <= 41 && Math.abs(r - (n - 7)) <= 2 && Math.abs(c - (n - 7)) <= 2;
  const bands: string[] = Array(BANDS).fill("");
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!m[r][c] || finder(r, c) || align(r, c)) continue;
    const b = Math.min(BANDS - 1, Math.floor(((r + c) / (2 * n - 1)) * BANDS));
    const x = c + q, y = r + q;
    bands[b] += `M${x + 0.5} ${y + 0.06}a.44 .44 0 1 1 0 .88a.44 .44 0 1 1 0-.88Z`;
  }
  const eyes: [number, number][] = [[0, 0], [0, n - 7], [n - 7, 0]];
  return (
    <svg viewBox={`0 0 ${V} ${V}`} className={cn("block h-auto w-full", className)} role="img" aria-label={label ?? `QR code for ${value.toLowerCase()}`} style={{ ["--qr-loop" as string]: `${loop}s` }}>
      {bands.map((d, i) => d && <path key={i} d={d} fill={fg} className={s.qrBand} style={{ ["--qr-delay" as string]: `${((i / BANDS) * sweep).toFixed(3)}s` }} />)}
      {eyes.map(([pr, pc], i) => {
        const ex = pc + q, ey = pr + q;
        return (
          <g key={i} className={s.qrEye} style={{ animationDelay: `${(i === 0 ? 0 : 0.25 * sweep).toFixed(2)}s` }}>
            <path fill={fg} fillRule="evenodd" d={rr(ex, ey, 7, 7, 2) + rr(ex + 1, ey + 1, 5, 5, 1)} />
            <path fill={eyeColor} d={rr(ex + 2, ey + 2, 3, 3, 0.9)} />
          </g>
        );
      })}
      {n >= 25 && n <= 41 && (
        <g className={s.qrEye} style={{ animationDelay: `${(0.6 * sweep).toFixed(2)}s` }}>
          <path fill={fg} fillRule="evenodd" d={rr(n - 9 + q, n - 9 + q, 5, 5, 1.4) + rr(n - 8 + q, n - 8 + q, 3, 3, 0.4)} />
          <path fill={fg} d={rr(n - 7 + q, n - 7 + q, 1, 1, 0.25)} />
        </g>
      )}
    </svg>
  );
}
