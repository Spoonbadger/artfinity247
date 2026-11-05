// GET /api/uploads/import/sample/<name>  (dev only: ALLOW_MOCK_IMPORT=1, 404 otherwise)
// The files behind the mock import source (../samples.ts). No login: the import route fetches these server-side.
//   painting-<seed>.jpg  a generated abstract painting, 2700 x 3600 px (prints at every size)
//   small-<seed>.jpg     the same at 480 x 640 px (too small to print)
//   scan.gif             a GIF (not a type we print)
//   expired.jpg          410 Gone, like an expired Dropbox link
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { mockImportAllowed } from "@/lib/cloudImport/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Small seeded random numbers, so a seed always draws the same painting. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function paintingSvg(seed: string, w: number, h: number) {
  const r = rng(seed);
  const hue = Math.floor(r() * 360);
  const col = (dh: number, s: number, l: number) => `hsl(${(hue + dh) % 360},${s}%,${l}%)`;
  const shapes: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = r() * w, y = r() * h, s = (0.15 + r() * 0.45) * w;
    const fill = col(Math.floor(r() * 160), 40 + Math.floor(r() * 50), 25 + Math.floor(r() * 50));
    shapes.push(r() < 0.5
      ? `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(s / 2).toFixed(0)}" fill="${fill}" opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`
      : `<rect x="${(x - s / 2).toFixed(0)}" y="${(y - s / 3).toFixed(0)}" width="${s.toFixed(0)}" height="${(s * (0.3 + r())).toFixed(0)}" fill="${fill}" opacity="${(0.55 + r() * 0.4).toFixed(2)}" transform="rotate(${Math.floor(r() * 40 - 20)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="${r().toFixed(2)}" y2="1"><stop offset="0" stop-color="${col(0, 55, 82)}"/><stop offset="1" stop-color="${col(40, 45, 35)}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes.join("")}</svg>`;
}

export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  if (!mockImportAllowed()) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const name = params.name;
  if (name === "expired.jpg") return new NextResponse("This link has expired", { status: 410 });
  if (name === "scan.gif") {
    const gif = await sharp(Buffer.from(paintingSvg("gif", 600, 800))).gif().toBuffer();
    return new NextResponse(new Uint8Array(gif), { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
  }
  const m = /^(painting|small)-([a-z0-9]{1,12})\.jpg$/.exec(name);
  if (!m) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const [w, h] = m[1] === "small" ? [480, 640] : [2700, 3600];
  const jpg = await sharp(Buffer.from(paintingSvg(m[2], w, h))).jpeg({ quality: 82 }).toBuffer();
  return new NextResponse(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Content-Length": String(jpg.length), "Cache-Control": "no-store" } });
}
