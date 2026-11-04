// Styled QR codes as SVG strings. Works on server and client.
// Dot shapes and corner styles were scan-tested (jsQR) across sizes and colors.
// The small alignment square is always drawn solid: breaking it into dots is
// the most common reason a styled code fails to scan.
import qrcode from "qrcode-generator";

export type DotStyle = "square" | "rounded" | "dots" | "liquid" | "lines" | "diamond";
export type EyeStyle = "frame" | "square" | "rounded" | "circle";
export type QrOptions = { fg?: string; dots?: DotStyle; eyes?: EyeStyle; eyeColor?: string | null; quiet?: number; label?: string };

const cache = new Map<string, boolean[][]>();
export function qrMatrix(text: string): boolean[][] {
  const hit = cache.get(text);
  if (hit) return hit;
  const q = qrcode(0, "M");
  // Upper-case URLs fit QR's compact alphanumeric mode: smaller grid, bigger printed dots.
  q.addData(text, /^[0-9A-Z $%*+\-./:]*$/.test(text) ? "Alphanumeric" : "Byte");
  q.make();
  const n = q.getModuleCount();
  const m: boolean[][] = [];
  for (let r = 0; r < n; r++) { m.push([]); for (let c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
  cache.set(text, m);
  return m;
}

const inFinder = (r: number, c: number, n: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
const inAlign = (r: number, c: number, n: number) => { if (n < 25 || n > 41) return false; const a = n - 7; return Math.abs(r - a) <= 2 && Math.abs(c - a) <= 2; };
function rr(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

export function qrSVG(text: string, opts: QrOptions = {}): string {
  const o = { fg: "#15161b", dots: "square" as DotStyle, eyes: "square" as EyeStyle, eyeColor: null as string | null, quiet: 2, label: "", ...opts };
  const m = qrMatrix(text);
  const n = m.length, q = o.quiet, V = n + q * 2;
  const dark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m[r][c] && !inFinder(r, c, n) && !inAlign(r, c, n);
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!dark(r, c)) continue;
    const x = c + q, y = r + q;
    switch (o.dots) {
      case "rounded": d += rr(x + 0.06, y + 0.06, 0.88, 0.88, 0.3); break;
      case "dots": d += `M${x + 0.5} ${y + 0.04}a.46 .46 0 1 1 0 .92a.46 .46 0 1 1 0-.92Z`; break;
      case "diamond": d += `M${x + 0.5} ${y}L${x + 1} ${y + 0.5}L${x + 0.5} ${y + 1}L${x} ${y + 0.5}Z`; break;
      case "liquid":
        d += `M${x + 0.5} ${y}a.5 .5 0 1 1 0 1a.5 .5 0 1 1 0-1Z`;
        if (dark(r, c + 1)) d += `M${x + 0.5} ${y}h1v1h-1Z`;
        if (dark(r + 1, c)) d += `M${x} ${y + 0.5}h1v1h-1Z`;
        break;
      case "lines": {
        if (dark(r, c - 1)) break;
        let len = 1; while (dark(r, c + len)) len++;
        d += rr(x + 0.08, y + 0.1, len - 0.16, 0.8, 0.4); break;
      }
      default: d += `M${x} ${y}h1v1h-1Z`;
    }
  }
  const label = (o.label || `QR code for ${text.toLowerCase()}`).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  let s = `<svg viewBox="0 0 ${V} ${V}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}"><path fill="${o.fg}" d="${d}"/>`;
  const pupil = o.eyeColor || o.fg;
  const R = { square: 0, rounded: 2, frame: 1.7, circle: 3.5 }[o.eyes] ?? 0;
  const Ri = { square: 0, rounded: 0.9, frame: 0.6, circle: 1.5 }[o.eyes] ?? 0;
  for (const [pr, pc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    const ex = pc + q, ey = pr + q;
    s += `<path fill="${o.fg}" fill-rule="evenodd" d="${rr(ex, ey, 7, 7, R)}${rr(ex + 1, ey + 1, 5, 5, Math.max(0, R - 1))}"/>`;
    s += `<path fill="${pupil}" d="${rr(ex + 2, ey + 2, 3, 3, Ri)}"/>`;
  }
  if (n >= 25 && n <= 41) {
    const a = n - 9 + q;
    const AR = { square: 0, rounded: 1.4, frame: 1.2, circle: 2.5 }[o.eyes] ?? 0;
    s += `<path fill="${o.fg}" fill-rule="evenodd" d="${rr(a, a, 5, 5, AR)}${rr(a + 1, a + 1, 3, 3, Math.max(0, AR - 1))}"/>`;
    s += `<path fill="${o.fg}" d="${rr(a + 2, a + 2, 1, 1, o.eyes === "circle" ? 0.5 : o.eyes === "square" ? 0 : 0.25)}"/>`;
  }
  return s + "</svg>";
}

/** A die-cut price tag for discounts ("10% OFF / when you scan"). */
export function tagSVG(pct: number, fill = "#ffd43b", ink = "#15161b", sub = "when you scan"): string {
  return `<svg viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${pct} percent off ${sub}">` +
    `<path d="M46 50 C 34 30, 20 22, 3 27" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>` +
    `<path fill="${fill}" fill-rule="evenodd" stroke="rgba(0,0,0,.18)" stroke-width="1.5" d="M60 4 H189 Q196 4 196 11 V89 Q196 96 189 96 H60 L20 50 Z M46 42 a8 8 0 1 0 0.01 0 Z"/>` +
    `<text x="128" y="62" text-anchor="middle" fill="${ink}" font-size="46" textLength="124" lengthAdjust="spacingAndGlyphs" style="font-family:var(--font-display);font-variation-settings:'wdth' 75;font-weight:800">${pct}% OFF</text>` +
    `<text x="128" y="84" text-anchor="middle" fill="${ink}" font-size="14" style="font-family:var(--font-body);font-weight:600">${sub}</text></svg>`;
}

/** URL a printed code holds today: the artwork page. (Planned: short /q/<code> links with editable server records.) */
export function scanUrl(slug: string, base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com") {
  return `${base.replace(/\/$/, "")}/art/${slug}`;
}
