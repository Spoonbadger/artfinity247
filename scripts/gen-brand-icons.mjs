// Site favicons, home-screen icons and the default share image, in the brand colours: node scripts/gen-brand-icons.mjs
// (The Studio's PWA icons in public/brand/app/ come from scripts/gen-app-icons.mjs.)
// Writes:
//   public/brand/favicon-32.png            rendered from public/brand/favicon.svg (32 px pixel art)
//   public/brand/favicon-16.png            the hand-drawn 16 px favicon, repainted from FROM to TO
//   public/favicon.ico                     favicon-16 + favicon-32 in one .ico
//   public/brand/icon-192.png, icon-512.png, apple-touch-icon.png   the mark (public/brand/mark.svg) on the wall colour
//   public/brand/og-image.png              the share image, repainted from FROM to TO (keeps its type exactly)
// Brand: Garnet Rose (Nov 2026). FROM is the palette the current PNGs were drawn in; after a run they are in TO.
// Pixels that are not on a FROM colour (or a blend of two) are left alone, so a second run changes nothing.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const pub = (p) => path.join(root, "public", p);

// The 2.0 Scan Blue palette -> Garnet Rose (app/globals.css).
const FROM = { scan: "#2b37f0", ink: "#15161b", quiet: "#4a4c55", wall: "#f2f3ec" };
const TO = { scan: "#8b2a4b", ink: "#2e1219", quiet: "#694c54", wall: "#f6ede9" };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const say = (f) => console.log("wrote", path.relative(root, f));

/** Repaint pixels on the line between two FROM colours (anti-aliased edges included) onto the same blend of TO colours. */
function repaintPixel(px, pairs, tol = 18) {
  let best = null;
  for (const [fa, fb, ta, tb] of pairs) {
    const d = fa.map((v, i) => v - fb[i]);
    const len = d.reduce((s, v) => s + v * v, 0);
    const t = Math.max(0, Math.min(1, px.reduce((s, v, i) => s + (v - fb[i]) * d[i], 0) / len));
    const off = Math.hypot(...px.map((v, i) => v - (fb[i] + t * d[i])));
    if (off <= tol && (!best || off < best.off)) best = { off, t, ta, tb };
  }
  if (!best) return null;
  return best.ta.map((v, i) => Math.round(best.tb[i] + best.t * (v - best.tb[i])));
}

async function repaint(file, pairsFor) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const out = repaintPixel([data[i], data[i + 1], data[i + 2]], pairsFor(x, y));
      if (out) [data[i], data[i + 1], data[i + 2]] = out;
    }
  const buf = await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(file, buf);
  say(file);
}
const pair = (a, b) => [rgb(FROM[a]), rgb(FROM[b]), rgb(TO[a]), rgb(TO[b])];

// 1. Favicons. The 32 px one is the SVG drawn pixel for pixel; the 16 px one is its own drawing (one colour plus white).
await sharp(pub("brand/favicon.svg"), { density: 72 }).png({ compressionLevel: 9 }).toFile(pub("brand/favicon-32.png"));
say(pub("brand/favicon-32.png"));
const white = [255, 255, 255];
await repaint(pub("brand/favicon-16.png"), () => [[rgb(FROM.scan), white, rgb(TO.scan), white]]);

// favicon.ico: a PNG-in-ICO container holding both sizes (every current browser reads it).
const pngs = [readFileSync(pub("brand/favicon-16.png")), readFileSync(pub("brand/favicon-32.png"))];
const head = Buffer.alloc(6 + 16 * pngs.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
let offset = head.length;
pngs.forEach((png, k) => {
  const size = k ? 32 : 16, e = 6 + 16 * k;
  head.writeUInt8(size, e); head.writeUInt8(size, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
writeFileSync(pub("favicon.ico"), Buffer.concat([head, ...pngs]));
say(pub("favicon.ico"));

// 2. Home-screen icons: the mark on the wall colour (sizes match the earlier files).
const mark = readFileSync(pub("brand/mark.svg"));
for (const [file, size, share] of [["brand/icon-512.png", 512, 0.74], ["brand/icon-192.png", 192, 0.76], ["brand/apple-touch-icon.png", 180, 0.81]]) {
  const m = Math.round(size * share);
  const markPng = await sharp(mark, { density: 72 * Math.ceil((m / 48) * 1.5) }).resize(m, m).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: TO.wall } })
    .composite([{ input: markPng, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(pub(file));
  say(pub(file));
}

// 3. Share image: logo row (mark at x 250-422, wordmark to the right), tagline below y 380.
await repaint(pub("brand/og-image.png"), (x, y) =>
  y >= 380 ? [pair("quiet", "wall")] : x <= 430 ? [pair("scan", "wall")] : [pair("ink", "wall")],
);
