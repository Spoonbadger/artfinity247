// Share images (story, post, link preview) as one SVG each, text outlined so sharp renders
// them the same everywhere. Server side: app/api/share/image turns this into a PNG.
import { qrSVG } from "@/lib/qr/render";
import { type Fonts, text, width, fitBlock, capHeight, fit } from "@/components/qr/text";
import { IMAGE_FORMATS, accentOf, dollars, type ImageFormat, type ImageLayout, type ShareArt } from "./shareData";

export type Picture = { href: string; w: number; h: number };
export type ShareImageInput = {
  format: ImageFormat;
  layout: ImageLayout;
  art: ShareArt;
  fonts: Fonts;
  painting: Picture;
  blurred?: string; // data URI of a blurred copy (Night show background)
  noise: string; // data URI of a small grain tile
  palette: string[];
  qrText: string;
  handle: string; // "theartfinity.com/@maya"
};

const n2 = (v: number) => +v.toFixed(2);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Painterly shapes (same paths as components/af/BrushDefs).
const SWATCH = "M2 9C30 1 72 13 112 6S178 1 198 10V60C170 69 122 57 80 65S22 60 2 66Z"; // 200 × 70
const STROKE = "M5 21C38 9 92 25 150 15S252 7 295 16L293 29C246 22 170 35 108 31S30 31 8 33Z"; // 300 × 40
const DAB = "M50 4C74 2 97 22 95 50S76 98 48 96 3 76 5 48 26 6 50 4Z"; // 100 × 100

function shape(d: string, vw: number, vh: number, x: number, y: number, w: number, h: number, fill: string, extra = "") {
  return `<path d="${d}" fill="${fill}" transform="translate(${n2(x)} ${n2(y)}) scale(${n2(w / vw)} ${n2(h / vh)})"${extra}/>`;
}
const swatch = (x: number, y: number, w: number, h: number, fill: string, extra = "") => shape(SWATCH, 200, 70, x, y, w, h, fill, extra);
const stroke = (x: number, y: number, w: number, h: number, fill: string, extra = "") => shape(STROKE, 300, 40, x, y, w, h, fill, extra);
const dab = (cx: number, cy: number, r: number, fill: string, rot = -14) =>
  `<path d="${DAB}" fill="${fill}" transform="translate(${n2(cx)} ${n2(cy)}) rotate(${rot}) scale(${n2(r / 50)}) translate(-50 -50)"/>`;

export function fitInto(iw: number, ih: number, bx: number, by: number, bw: number, bh: number) {
  const k = Math.min(bw / iw, bh / ih);
  const w = iw * k, h = ih * k;
  return { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w, h };
}

function brand(f: Fonts, x: number, y: number, size: number, ink: string, accent: string) {
  const b = size * 0.95, gap = size * 0.32, k = b / 24, top = y - capHeight(f.display) * size - b * 0.06;
  return `<g transform="translate(${n2(x)} ${n2(top)}) scale(${n2(k)})"><rect x="1" y="1" width="22" height="22" rx="3.5" fill="none" stroke="${ink}" stroke-width="1.8"/><rect x="8.25" y="8.25" width="7.5" height="7.5" rx="1.6" fill="${accent}"/></g>` +
    text(f.display, "artfinity", x + b + gap, y, size, ink);
}

function qrAt(qrText: string, x: number, y: number, size: number, title: string) {
  return qrSVG(qrText, { fg: "#15161b", dots: "rounded", eyes: "frame", eyeColor: "#8b2a4b", label: esc(`QR code for ${title}`) })
    .replace("<svg ", `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" `);
}

/** "Prints from $49.99" on a yellow brush swatch. y = top. Returns markup and height. */
function priceChip(f: Fonts, label: string, x: number, y: number, size: number) {
  const tw = width(f.semi, label, size), padX = size * 0.75, h = size * 2.05;
  const w = tw + padX * 2;
  return {
    svg: swatch(x - size * 0.2, y, w, h, "#ffd43b") + text(f.semi, label, x - size * 0.2 + padX, y + h / 2 + capHeight(f.semi) * size / 2, size, "#15161b"),
    h, w,
  };
}

type Geo = {
  paint: { x: number; y: number; w: number; h: number };
  logo: { x: number; y: number; size: number };
  col: { x: number; y: number; w: number };
  title: { max: number; min: number; lines: number; maxH: number };
  by: number; // artist line size
  chip: number; // price size
  qr: { x: number; y: number; size: number };
  scan: { x: number; y: number; size: number; w: number; under?: boolean }; // "Scan or tap to buy a print"
};

function geometry(format: ImageFormat): Geo {
  if (format === "story") return {
    paint: { x: 130, y: 210, w: 820, h: 860 },
    logo: { x: 90, y: 130, size: 40 },
    col: { x: 96, y: 1160, w: 888 },
    title: { max: 104, min: 58, lines: 2, maxH: 200 },
    by: 38, chip: 36,
    qr: { x: 112, y: 1574, size: 236 },
    scan: { x: 392, y: 1630, size: 62, w: 580 },
  };
  if (format === "square") return {
    paint: { x: 64, y: 64, w: 520, h: 952 },
    logo: { x: 640, y: 116, size: 32 },
    col: { x: 640, y: 196, w: 384 },
    title: { max: 84, min: 44, lines: 3, maxH: 250 },
    by: 30, chip: 28,
    qr: { x: 640, y: 744, size: 206 },
    scan: { x: 872, y: 792, size: 36, w: 160 },
  };
  return {
    paint: { x: 62, y: 58, w: 408, h: 514 },
    logo: { x: 522, y: 92, size: 28 },
    col: { x: 522, y: 150, w: 630 },
    title: { max: 74, min: 40, lines: 2, maxH: 150 },
    by: 26, chip: 24,
    qr: { x: 976, y: 400, size: 180 },
    scan: { x: 522, y: 470, size: 40, w: 430 },
  };
}

export function shareSVG(i: ShareImageInput): string {
  const { W, H } = { W: IMAGE_FORMATS[i.format].w, H: IMAGE_FORMATS[i.format].h };
  const f = i.fonts, g = geometry(i.format), L = i.layout;
  const accent = accentOf(i.palette);
  const dark = L === "bleed";
  const ink = dark ? "#ffffff" : "#15161b";
  const soft = dark ? "rgba(255,255,255,.78)" : "#5a5d6b";
  const pic = fitInto(i.painting.w, i.painting.h, g.paint.x, g.paint.y, g.paint.w, g.paint.h);
  const T = fitBlock(f.display, i.art.title, { max: g.title.max, min: g.title.min, maxW: g.col.w, maxH: g.title.maxH, lh: 0.95, maxLines: g.title.lines });
  if (i.format === "story") {
    // Painting and words sit together, centred between the logo and the QR card.
    const textH = capHeight(f.display) * T.size + (T.lines.length - 1) * T.size * 0.95 + g.by * 2.45 + g.chip * 2.25 + (i.art.editionSize ? g.chip * 1.38 : 0);
    const gap = 96, top = 190, bottom = 1500;
    const y0 = top + Math.max(0, (bottom - top - (pic.h + gap + textH)) / 2);
    pic.y = y0;
    g.col.y = y0 + pic.h + gap;
  }
  const cx = pic.x + pic.w / 2, cy = pic.y + pic.h / 2;
  const u = W / 1080; // painterly marks scale with the canvas

  let defs = `<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${n2(16 * u)}"/></filter>` +
    `<pattern id="grain" width="200" height="200" patternUnits="userSpaceOnUse"><image href="${i.noise}" width="200" height="200"/></pattern>`;
  let s = "";

  // ---- background
  if (L === "wall") {
    s += `<rect width="${W}" height="${H}" fill="#f2f3ec"/>`;
    defs += `<radialGradient id="light" cx="50%" cy="22%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
    s += `<rect width="${W}" height="${H}" fill="url(#light)"/>`;
  } else if (L === "bleed") {
    s += `<rect width="${W}" height="${H}" fill="#15161b"/>`;
    if (i.blurred) s += `<image href="${i.blurred}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity=".9"/>`;
    defs += `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15161b" stop-opacity=".35"/><stop offset=".55" stop-color="#15161b" stop-opacity=".6"/><stop offset="1" stop-color="#15161b" stop-opacity=".88"/></linearGradient>`;
    s += `<rect width="${W}" height="${H}" fill="url(#shade)"/>`;
  } else {
    s += `<rect width="${W}" height="${H}" fill="#fbfaf5"/>`;
  }
  s += `<rect width="${W}" height="${H}" fill="url(#grain)" opacity="${dark ? 0.35 : 0.6}"/>`;

  // ---- painterly marks behind the painting
  if (L === "wall") {
    s += swatch(pic.x + pic.w * 0.42, pic.y + pic.h - 30 * u, pic.w * 0.78, 110 * u, accent, ` opacity=".9"`);
  } else if (L === "studio") {
    s += `<g transform="rotate(4 ${n2(cx)} ${n2(cy)})">` + swatch(pic.x - 70 * u, pic.y + 50 * u, pic.w + (i.format === "story" ? 150 : 110) * u, pic.h + 30 * u, accent, ` opacity=".92"`) + `</g>`;
  } else {
    s += stroke(pic.x - 120 * u, pic.y + pic.h * 0.55, pic.w + 240 * u, 140 * u, "#ffffff", ` opacity=".12"`);
  }

  // ---- the painting
  const rot = L === "studio" ? -2.5 : 0;
  const mat = L === "wall" ? Math.round(18 * u) : L === "studio" ? Math.round(14 * u) : Math.round(8 * u);
  const fr = L === "wall" ? Math.round(10 * u) : 0;
  const ox = pic.x - mat - fr, oy = pic.y - mat - fr, ow = pic.w + 2 * (mat + fr), oh = pic.h + 2 * (mat + fr);
  s += `<g transform="rotate(${rot} ${n2(cx)} ${n2(cy)})">`;
  s += `<rect x="${n2(ox + 6 * u)}" y="${n2(oy + 22 * u)}" width="${n2(ow)}" height="${n2(oh)}" fill="#000" opacity="${dark ? 0.55 : 0.28}" filter="url(#soft)"/>`;
  if (fr) s += `<rect x="${n2(ox)}" y="${n2(oy)}" width="${n2(ow)}" height="${n2(oh)}" fill="#15161b"/>`;
  s += `<rect x="${n2(ox + fr)}" y="${n2(oy + fr)}" width="${n2(ow - 2 * fr)}" height="${n2(oh - 2 * fr)}" fill="#ffffff"/>`;
  s += `<image href="${i.painting.href}" x="${n2(pic.x)}" y="${n2(pic.y)}" width="${n2(pic.w)}" height="${n2(pic.h)}" preserveAspectRatio="xMidYMid slice"/>`;
  if (L === "studio") {
    const tw = 150 * u, th = 44 * u;
    s += `<rect x="${n2(ox - tw * 0.3)}" y="${n2(oy - th * 0.35)}" width="${n2(tw)}" height="${n2(th)}" fill="#ffd43b" opacity=".78" transform="rotate(-32 ${n2(ox)} ${n2(oy)})"/>`;
    s += `<rect x="${n2(ox + ow - tw * 0.7)}" y="${n2(oy - th * 0.35)}" width="${n2(tw)}" height="${n2(th)}" fill="#ffd43b" opacity=".78" transform="rotate(32 ${n2(ox + ow)} ${n2(oy)})"/>`;
  }
  s += `</g>`;

  // ---- words
  s += brand(f, g.logo.x, g.logo.y, g.logo.size, ink, dark ? "#ffd43b" : "#8b2a4b");
  let y = g.col.y + capHeight(f.display) * T.size;
  T.lines.forEach((line, k) => { s += text(f.display, line, g.col.x, y + k * T.size * 0.95, T.size, ink); });
  y += (T.lines.length - 1) * T.size * 0.95 + g.by * 1.55;
  s += text(f.body, fit(f.body, `by ${i.art.artist}`, g.by, g.col.w), g.col.x, y, g.by, soft);
  y += g.by * 0.9;
  const chip = priceChip(f, `Prints from ${dollars(i.art.fromCents)}`, g.col.x, y, g.chip);
  s += chip.svg;
  y += chip.h + g.chip * 0.2;
  if (i.art.editionSize) {
    const es = g.chip * 0.86;
    s += dab(g.col.x + es * 0.45, y + es * 0.75, es * 0.38, "#ff5a36");
    s += text(f.semi, `Limited edition of ${i.art.editionSize}`, g.col.x + es * 1.2, y + es * 0.75 + capHeight(f.semi) * es / 2, es, ink);
    y += es * 1.6;
  }

  // Palette dabs (Studio table): the painting's own colors.
  if (L === "studio") {
    const r = 22 * u, px = i.format === "landscape" ? g.col.x + r : g.col.x + r;
    const py = i.format === "story" ? 1488 : 680;
    if (i.format !== "landscape" && y < py - r) i.palette.slice(0, 5).forEach((c, k) => { s += dab(px + k * r * 2.5, py, r, c, -14 + k * 23); });
  }

  // ---- QR block
  const q = g.qr, pad = q.size * 0.07;
  const cardW = i.format === "story" ? 888 : q.size + pad * 2;
  const cardX = i.format === "story" ? 96 : q.x - pad;
  if (i.format === "story") {
    s += `<rect x="${cardX}" y="${q.y - pad}" width="${cardW}" height="${n2(q.size + pad * 2)}" rx="22" fill="#ffffff"${dark ? "" : ` stroke="#e1e2da" stroke-width="2"`}/>`;
  } else {
    s += `<rect x="${n2(cardX)}" y="${n2(q.y - pad)}" width="${n2(cardW)}" height="${n2(q.size + pad * 2)}" rx="${n2(pad * 1.4)}" fill="#ffffff"${dark ? "" : ` stroke="#e1e2da" stroke-width="2"`}/>`;
  }
  s += qrAt(i.qrText, q.x, q.y, q.size, i.art.title);
  const sc = g.scan;
  const scanInk = i.format === "story" ? "#15161b" : ink;
  const scanSoft = i.format === "story" ? "#5a5d6b" : soft;
  const lines = i.format === "square" ? ["Scan", "to buy", "a print"] : ["Scan or tap", "to buy a print"];
  let sy = sc.y + capHeight(f.display) * sc.size;
  lines.forEach((ln, k) => { s += text(f.display, ln, sc.x, sy + k * sc.size * 0.98, sc.size, scanInk); });
  sy += (lines.length - 1) * sc.size * 0.98;
  const hs = i.format === "story" ? 32 : i.format === "square" ? 22 : 24;
  if (i.format === "square") {
    s += text(f.semi, fit(f.semi, i.handle, hs, 440), 640, 1016, hs, soft);
  } else {
    s += stroke(sc.x - 8, sy + hs * 0.55, Math.min(sc.w, width(f.semi, i.handle, hs) + 24), hs * 1.25, i.format === "story" ? "#ffd43b" : accent, ` opacity="${i.format === "story" ? 0.9 : 0.55}"`);
    s += text(f.semi, fit(f.semi, i.handle, hs, sc.w), sc.x, sy + hs * 1.55, hs, scanSoft === soft && dark ? "#ffffff" : scanInk);
  }

  const label = esc(`${i.art.title} by ${i.art.artist}. Prints from ${dollars(i.art.fromCents)}. Scan to buy a print.`);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><defs>${defs}</defs>${s}</svg>`;
}
