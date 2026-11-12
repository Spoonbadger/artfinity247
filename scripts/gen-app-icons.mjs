// Studio app icons (PWA) from the logo mark: node scripts/gen-app-icons.mjs
// Writes to public/brand/app/:
//   icon-192.png, icon-512.png            the mark on wall-white, for "any" purpose
//   icon-maskable-192.png, -512.png       full-bleed wall-white, mark inside the 80% safe circle
//   apple-touch-icon.png (180)            iOS home screen (iOS adds its own rounded corners)
//   shortcut-upload.png, -qr.png, -money.png (96)   manifest shortcut icons
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "public/brand/app");
mkdirSync(out, { recursive: true });
const mark = readFileSync(path.join(root, "public/brand/mark.svg"));
const WALL = "#f6ede9"; // --af-wall (Garnet Rose blush plaster)

async function icon(file, size, markShare, bg = WALL) {
  const m = Math.round(size * markShare);
  const markPng = await sharp(mark, { density: 72 * Math.ceil((m / 48) * 1.5) }).resize(m, m).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: markPng, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(out, file));
  console.log("wrote", path.relative(root, path.join(out, file)));
}

// The mark's paint fills ~87% of its 48px box. "any": a generous mark; maskable: the whole mark
// (corners included) stays inside the centered circle of radius 40% that every mask keeps.
await icon("icon-192.png", 192, 0.74);
await icon("icon-512.png", 512, 0.74);
await icon("icon-maskable-192.png", 192, 0.62);
await icon("icon-maskable-512.png", 512, 0.62);
await icon("apple-touch-icon.png", 180, 0.7);

// Shortcut icons: a coloured dab (the Studio's painterly marker) behind a simple glyph.
const glyphs = {
  upload: `<path d="M48 70V30M32 45l16-16 16 16" stroke="#2e1219" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  qr: `<g fill="#2e1219"><rect x="26" y="26" width="18" height="18" rx="2"/><rect x="52" y="26" width="18" height="18" rx="2"/><rect x="26" y="52" width="18" height="18" rx="2"/><rect x="54" y="54" width="6" height="6"/><rect x="62" y="62" width="8" height="8"/><rect x="52" y="64" width="6" height="6"/></g>`,
  money: `<text x="48" y="66" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="48" fill="#2e1219">$</text>`,
};
const dabs = { upload: "#ff8a5c", qr: "#ffd43b", money: "#7fd1ad" };
for (const [name, glyph] of Object.entries(glyphs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${WALL}"/><path d="M14 50c-2-20 12-36 34-37 22-1 36 13 35 33-1 22-16 37-37 36-19-1-30-12-32-32z" fill="${dabs[name]}"/>${glyph}</svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(out, `shortcut-${name}.png`));
  console.log("wrote", `public/brand/app/shortcut-${name}.png`);
}
