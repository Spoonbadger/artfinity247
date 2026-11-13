#!/usr/bin/env node
// Synthetic TEST FIXTURES for the photo-scene pipeline. These are NOT photographs and must never be shown as real
// scenes: flat-shaded rooms drawn from a tiny 3D model, with a silhouette figure, furniture and a door at known sizes,
// so the annotation tool and the compositor can be checked against ground truth before real photos arrive.
//
//   node scripts/scenes/make-fixtures.mjs            -> scenes/fixtures/fx-*.jpg + .json (meta + ground truth)
//   node scripts/scenes/make-fixtures.mjs --annotate fx-gallery-door,fx-procedural-living
//                                                     also writes ground-truth annotations for those ids
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const jiti = createRequire(require.resolve("tailwindcss"))("jiti")(fileURLToPath(import.meta.url), { alias: { "@": root }, interopDefault: true });
const OUT = path.join(root, "scenes", "fixtures");
const ANN = path.join(root, "scenes", "annotations");
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const annotateIds = (args[args.indexOf("--annotate") + 1] || "").split(",").filter(Boolean);
if (!args.includes("--annotate")) annotateIds.length = 0;

// ---------- a tiny pinhole camera (level: vertical lines stay vertical) ----------
function camera({ W, H, f, eye, x = 0, yaw = 0 }) {
  const yr = (yaw * Math.PI) / 180;
  const right = [Math.cos(yr), 0, -Math.sin(yr)], fwd = [Math.sin(yr), 0, Math.cos(yr)];
  return (p) => {
    const d = [p[0] - x, p[1] - eye, p[2]];
    const xc = d[0] * right[0] + d[2] * right[2], zc = d[0] * fwd[0] + d[2] * fwd[2];
    return [W / 2 + (f * xc) / zc, H / 2 - (f * d[1]) / zc];
  };
}
/** A plane: origin o, horizontal unit u (along the wall), normal pointing toward the camera n. pt(s, y, off) */
const plane = (o, u, n) => (s, y, off = 0) => [o[0] + u[0] * s + n[0] * off, y, o[2] + u[2] * s + n[2] * off];
const f2 = (v) => Math.round(v * 10) / 10;
const pts = (P) => P.map((p) => `${f2(p[0])},${f2(p[1])}`).join(" ");
const poly = (P, fill, extra = "") => `<polygon points="${pts(P)}" fill="${fill}" ${extra}/>`;

/** Silhouette of a standing adult, 66 in tall, in (s, y) inches; feet at y = 0, centered on s = 0. */
function adultOutline(h = 66) {
  const k = h / 66;
  const head = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    head.push([3.1 * Math.cos(a) * k, (61.6 + 4.4 * Math.sin(a)) * k]);
  }
  const body = [
    [-1.6, 57], [-6.5, 55.5], [-8.6, 53], [-9.4, 44], [-9.8, 33], [-8.2, 32.6], [-7.6, 43], [-7.2, 47], [-6.9, 36], [-6.4, 31],
    [-5.6, 16], [-5.4, 1.4], [-7.6, 0.2], [-7.6, 0], [-1.2, 0], [-1.1, 3], [-0.6, 26], [0.6, 26], [1.1, 3], [1.2, 0], [7.6, 0], [7.6, 0.2],
    [5.4, 1.4], [5.6, 16], [6.4, 31], [6.9, 36], [7.2, 47], [7.6, 43], [8.2, 32.6], [9.8, 33], [9.4, 44], [8.6, 53], [6.5, 55.5], [1.6, 57],
  ].map(([s, y]) => [s * k, y * k]);
  return { head, body };
}
/** Seated adult in profile-ish silhouette on a chair, head top at 50 in. */
function seatedOutline() {
  const head = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    head.push([3 * Math.cos(a), 45.7 + 4.3 * Math.sin(a)]);
  }
  const body = [[-1.5, 41.5], [-6.5, 40], [-8, 36], [-8, 18.5], [-7, 17.5], [6, 17.5], [6.5, 1], [9, 0], [9, 0.3], [3.8, 1.5], [3.4, 15], [-1, 15.5], [-1, 17.5], [7.5, 18.5], [8, 22], [6, 36], [4.5, 40], [1.5, 41.5]];
  return { head, body };
}

function boxFaces(proj, camPos, x0, x1, y0, y1, z0, z1) {
  const P = (x, y, z) => [x, y, z];
  const faces = [
    { c: [x0, y1, (z0 + z1) / 2, "top"], v: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], n: [0, 1, 0] },
    { c: "front", v: [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], n: [0, 0, -1] },
    { c: "left", v: [P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)], n: [-1, 0, 0] },
    { c: "right", v: [P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0)], n: [1, 0, 0] },
  ];
  return faces
    .filter((fc) => {
      const ctr = fc.v.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
      const toCam = [camPos[0] - ctr[0], camPos[1] - ctr[1], camPos[2] - ctr[2]];
      return toCam[0] * fc.n[0] + toCam[1] * fc.n[1] + toCam[2] * fc.n[2] > 0;
    })
    .map((fc) => ({ kind: fc.n[1] ? "top" : fc.n[2] ? "front" : "side", pts: fc.v.map(proj) }));
}
const shadeBox = (faces, base) => faces.map((fc) => poly(fc.pts, base[fc.kind])).join("");

const watermark = (W) =>
  `<g font-family="DejaVu Sans, Arial, sans-serif" font-weight="700"><rect x="18" y="18" width="${Math.min(W - 36, 640)}" height="44" rx="8" fill="#ff2d6f"/><text x="34" y="48" font-size="24" fill="#fff">SYNTHETIC TEST FIXTURE · not a photo</text></g>`;

// ---------- fixture 1: frontal living room, standing adult against the wall ----------
function livingFrontal() {
  const W = 2000, H = 1333, f = 1300, eye = 54, Z = 150;
  const proj = camera({ W, H, f, eye });
  const wall = plane([0, 0, Z], [1, 0, 0], [0, 0, -1]);
  const svg = [];
  svg.push(`<defs><radialGradient id="win" cx="0.15" cy="0.3" r="0.9"><stop offset="0" stop-color="#fff6e6" stop-opacity=".55"/><stop offset="1" stop-color="#fff6e6" stop-opacity="0"/></radialGradient>
    <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6544"/><stop offset="1" stop-color="#a77d55"/></linearGradient></defs>`);
  svg.push(`<rect width="${W}" height="${H}" fill="#e3ddd2"/>`);
  // floor + planks
  const fy = proj(wall(0, 0))[1];
  svg.push(`<rect x="0" y="${fy}" width="${W}" height="${H - fy}" fill="url(#fl)"/>`);
  for (let s = -400; s <= 400; s += 7) svg.push(`<line x1="${f2(proj([s, 0, Z])[0])}" y1="${f2(fy)}" x2="${f2(proj([s, 0, 30])[0])}" y2="${f2(proj([s, 0, 30])[1])}" stroke="#6e4f33" stroke-opacity=".35" stroke-width="1.2"/>`);
  // ceiling line, baseboard, light
  svg.push(`<rect x="0" y="0" width="${W}" height="${f2(proj(wall(0, 108))[1])}" fill="#f1eee8"/>`);
  svg.push(`<rect width="${W}" height="${f2(fy)}" fill="url(#win)"/>`);
  svg.push(poly([wall(-400, 0), wall(400, 0), wall(400, 5), wall(-400, 5)].map(proj), "#f4f1ea"));
  // sofa: 84 in wide, back 32 in, seat 18 in, arms 25 in
  const cam = [0, eye, 0];
  const sofa = { top: "#5e7184", front: "#4b5d70", side: "#41515f" };
  svg.push(shadeBox(boxFaces(proj, cam, -52, 32, 0, 32, Z - 9, Z), sofa));
  svg.push(shadeBox(boxFaces(proj, cam, -48, 28, 0, 18, Z - 36, Z - 9), sofa));
  svg.push(shadeBox(boxFaces(proj, cam, -52, -46, 0, 25, Z - 36, Z - 9), sofa));
  svg.push(shadeBox(boxFaces(proj, cam, 26, 32, 0, 25, Z - 36, Z - 9), sofa));
  // floor lamp
  svg.push(shadeBox(boxFaces(proj, cam, -79, -77, 0, 60, Z - 14, Z - 12), { top: "#222", front: "#2a2a2a", side: "#222" }));
  svg.push(poly([[-86, 58, Z - 13], [-70, 58, Z - 13], [-73, 70, Z - 13], [-83, 70, Z - 13]].map(proj), "#f3e3c3"));
  // standing adult with their back to the wall (4 in off it)
  const person = adultOutline(66);
  const off = 4, ps = 62;
  const toImg = (p) => proj(wall(ps + p[0], p[1], off));
  svg.push(poly(person.body.map(toImg), "#2e3239"), poly(person.head.map(toImg), "#2e3239"));
  svg.push(watermark(W));
  const truth = {
    quad: [wall(-92, 96), wall(42, 96), wall(42, 36), wall(-92, 36)].map(proj),
    anchors: [proj(wall(-10, 62)), proj(wall(-60, 62)), proj(wall(30, 62))],
    ref: { a: toImg([0, 0]), b: toImg([0, 66]), kind: "adult", inches: 66 },
    ppiWall: f / Z,
    ppiRef: f / (Z - off),
  };
  return { id: "fx-living-frontal", W, H, svg, truth, tags: ["living", "person"], desc: "Frontal living-room wall, sofa (32 in back), standing adult (66 in) against the wall." };
}

// ---------- fixture 2: café, oblique brick wall, standing adult + tables ----------
function cafeOblique() {
  const W = 2000, H = 1333, f = 1150, eye = 60, yaw = 9;
  const proj = camera({ W, H, f, eye, yaw });
  const yr = (yaw * Math.PI) / 180;
  const zc = (p) => p[0] * Math.sin(yr) + p[2] * Math.cos(yr);
  const th = (27 * Math.PI) / 180;
  const u = [Math.cos(th), 0, Math.sin(th)], n = [Math.sin(th), 0, -Math.cos(th)];
  const O = [0, 0, 165];
  const wall = plane(O, u, n);
  const svg = [];
  svg.push(`<defs><linearGradient id="lt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2d9" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>`);
  svg.push(`<rect width="${W}" height="${H / 2}" fill="#2a2522"/><rect y="${H / 2}" width="${W}" height="${H / 2}" fill="#b9b2a6"/>`);
  // floor tile grid on y = 0, clipped to the space in front of the camera
  const line3 = (p, q, stroke) => {
    const za = zc(p), zb = zc(q);
    if (za < 8 && zb < 8) return "";
    if (za < 8) p = p.map((v, i) => v + ((q[i] - v) * (8 - za)) / (zb - za));
    if (zb < 8) q = q.map((v, i) => v + ((p[i] - v) * (8 - zb)) / (za - zb));
    const a = proj(p), b = proj(q);
    return `<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" ${stroke}/>`;
  };
  for (let x = -600; x <= 600; x += 18) svg.push(line3([x, 0, 0], [x, 0, 900], 'stroke="#8f887c" stroke-opacity=".6"'));
  for (let z = 18; z <= 900; z += 18) svg.push(line3([-600, 0, z], [600, 0, z], 'stroke="#8f887c" stroke-opacity=".6"'));
  // the brick wall from s = -110 to 420, floor to 132 in
  svg.push(poly([wall(-110, 0), wall(420, 0), wall(420, 132), wall(-110, 132)].map(proj), "#a4563d"));
  for (let y = 2.67, row = 0; y < 132; y += 2.67, row++) {
    svg.push(`<line x1="${f2(proj(wall(-110, y))[0])}" y1="${f2(proj(wall(-110, y))[1])}" x2="${f2(proj(wall(420, y))[0])}" y2="${f2(proj(wall(420, y))[1])}" stroke="#d8cfc0" stroke-opacity=".4" stroke-width="1"/>`);
    for (let s = -108 + (row % 2) * 4; s < 420; s += 8) {
      const a = proj(wall(s, y - 2.67)), b = proj(wall(s, y));
      svg.push(`<line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" stroke="#d8cfc0" stroke-opacity=".3" stroke-width="1"/>`);
    }
  }
  svg.push(poly([wall(-110, 0), wall(420, 0), wall(420, 132), wall(-110, 132)].map(proj), "url(#lt)"));
  // a 32 × 80 in door in the wall, with trim (the optional width reference)
  svg.push(poly([wall(176.5, 0), wall(215.5, 0), wall(215.5, 83.5), wall(176.5, 83.5)].map(proj), "#2b2b2b"));
  svg.push(poly([wall(180, 0), wall(212, 0), wall(212, 80), wall(180, 80)].map(proj), "#5d6b62"));
  // ceiling
    // café tables (30 in) and chairs along the wall, built in wall coordinates
  const inWall = (s0, s1, y0, y1, d0, d1) => [
    [wall(s0, y1, d0), wall(s1, y1, d0), wall(s1, y1, d1), wall(s0, y1, d1)], // top
    [wall(s0, y0, d1), wall(s1, y0, d1), wall(s1, y1, d1), wall(s0, y1, d1)], // front
    [wall(s0, y0, d0), wall(s0, y0, d1), wall(s0, y1, d1), wall(s0, y1, d0)], // left side
  ];
  const drawBox = (s0, s1, y0, y1, d0, d1, c) => {
    const [top, front, side] = inWall(s0, s1, y0, y1, d0, d1);
    return poly(side.map(proj), c[2]) + poly(front.map(proj), c[1]) + poly(top.map(proj), c[0]);
  };
  for (const s of [-70, 130]) {
    svg.push(drawBox(s - 1, s + 1, 0, 29, 11, 13, ["#222", "#1d1d1d", "#181818"]));
    svg.push(drawBox(s - 12, s + 12, 29, 30, 1, 23, ["#e8e2d6", "#c9c1b3", "#b8b0a2"]));
    svg.push(drawBox(s + 14, s + 30, 17, 18, 4, 20, ["#6b4a2f", "#5a3e27", "#4e3622"]));
    svg.push(drawBox(s + 28, s + 30, 18, 34, 4, 20, ["#6b4a2f", "#5a3e27", "#4e3622"]));
  }
  // a seated adult at the left table (head top 50 in)
  const seat = seatedOutline();
  const seatImg = (p) => proj(wall(-70 + 22 - p[0], p[1], 12));
  svg.push(poly(seat.body.map(seatImg), "#2c2f36"), poly(seat.head.map(seatImg), "#2c2f36"));
  // a standing adult with their back to the wall
  const person = adultOutline(66);
  const ps = 22, off = 4;
  const toImg = (p) => proj(wall(ps + p[0], p[1], off));
  svg.push(poly(person.body.map(toImg), "#24272d"), poly(person.head.map(toImg), "#24272d"));
  // pendant lamps
  for (const s of [-70, 130]) {
    const top = proj(wall(s, 132, 30)), b = proj(wall(s, 84, 30));
    svg.push(`<line x1="${f2(top[0])}" y1="${f2(top[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}" stroke="#111" stroke-width="2"/>`);
    svg.push(poly([wall(s - 6, 78, 30), wall(s + 6, 78, 30), wall(s + 3, 84, 30), wall(s - 3, 84, 30)].map(proj), "#f6d58b"));
  }
  svg.push(watermark(W));
  // ppi at the anchor, measured numerically from the model (1 in steps on the wall)
  const anc = wall(-15, 64);
  const ppiAt = (s, y) => {
    const a = proj(wall(s - 0.5, y)), b = proj(wall(s + 0.5, y)), c = proj(wall(s, y - 0.5)), d = proj(wall(s, y + 0.5));
    return Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(d[0] - c[0], d[1] - c[1]));
  };
  const truth = {
    quad: [wall(-80, 100), wall(70, 100), wall(70, 38), wall(-80, 38)].map(proj),
    anchors: [proj(anc), proj(wall(-55, 64)), proj(wall(50, 64))],
    ref: { a: toImg([0, 0]), b: toImg([0, 66]), kind: "adult", inches: 66 },
    ref2: { a: proj(wall(180, 80)), b: proj(wall(212, 80)), kind: "doorw", inches: 32 },
    ppiWall: ppiAt(-15, 64),
    lens: (f * 43.27) / Math.hypot(W, H),
  };
  return { id: "fx-cafe-oblique", W, H, svg, truth, tags: ["cafe", "person", "warm"], desc: "Oblique brick café wall (38° to the camera), standing adult (66 in), seated adult, 30 in tables." };
}

// ---------- fixture 3: portrait gallery wall with a door ----------
function galleryDoor() {
  const W = 1400, H = 1750, f = 1050, eye = 62, Z = 210;
  const proj = camera({ W, H, f, eye });
  const wall = plane([0, 0, Z], [1, 0, 0], [0, 0, -1]);
  const svg = [];
  svg.push(`<rect width="${W}" height="${H}" fill="#f2f1ee"/>`);
  const fy = proj(wall(0, 0))[1];
  svg.push(`<rect x="0" y="${fy}" width="${W}" height="${H - fy}" fill="#9a9894"/>`);
  for (let z = Z; z > 40; z -= 24) svg.push(`<line x1="0" y1="${f2(proj([0, 0, z])[1])}" x2="${W}" y2="${f2(proj([0, 0, z])[1])}" stroke="#7d7b77" stroke-opacity=".5"/>`);
  svg.push(poly([wall(-300, 0), wall(300, 0), wall(300, 4), wall(-300, 4)].map(proj), "#e2e0db"));
  // door 32 × 80 in with 3.5 in trim
  svg.push(poly([wall(-118.5, 0), wall(-79.5, 0), wall(-79.5, 83.5), wall(-118.5, 83.5)].map(proj), "#d9d6cf"));
  svg.push(poly([wall(-115, 0), wall(-83, 0), wall(-83, 80), wall(-115, 80)].map(proj), "#6f6a61"));
  svg.push(`<circle cx="${f2(proj(wall(-87, 36))[0])}" cy="${f2(proj(wall(-87, 36))[1])}" r="5" fill="#c8b27a"/>`);
  // a bench (18 in) in front of the wall and a standing visitor further out (not at wall depth: not the reference)
  const cam = [0, eye, 0];
  svg.push(shadeBox(boxFaces(proj, cam, -30, 30, 16, 18, Z - 60, Z - 44), { top: "#3d3d3d", front: "#333", side: "#2c2c2c" }));
  for (const x of [-27, 25]) svg.push(shadeBox(boxFaces(proj, cam, x, x + 2, 0, 16, Z - 59, Z - 45), { top: "#333", front: "#2b2b2b", side: "#262626" }));
  const person = adultOutline(68);
  const pz = Z - 70;
  svg.push(poly(person.body.map((p) => proj([48 + p[0], p[1], pz])), "#30343b"), poly(person.head.map((p) => proj([48 + p[0], p[1], pz])), "#30343b"));
  svg.push(watermark(W));
  const truth = {
    quad: [wall(-70, 110), wall(80, 110), wall(80, 34), wall(-70, 34)].map(proj),
    anchors: [proj(wall(5, 60))],
    ref: { a: proj(wall(-99, 0)), b: proj(wall(-99, 80)), kind: "door", inches: 80 },
    ppiWall: f / Z,
  };
  return { id: "fx-gallery-door", W, H, svg, truth, tags: ["gallery", "person"], desc: "Portrait gallery wall with an 80 in door (the reference), a bench and a visitor standing 70 in in front of the wall." };
}

// ---------- fixture 4: an existing procedural room rendered to JPEG ----------
function proceduralLiving() {
  const { buildScene, renderScene } = jiti(path.join(root, "lib/rooms/scene.ts"));
  const n = 8; // a living room (n % 8 === 0)
  const b = buildScene(n);
  const [vx, vy, vw, vh] = b.viewBox.split(" ").map(Number);
  const W = 1600, H = Math.round(1600 / (vw / vh));
  const s = W / vw;
  const FLOOR = 108;
  const img = (x, hIn) => [(x - vx) * s, (FLOOR - hIn - vy) * s];
  const cx = b.hang.cx;
  const svgText = renderScene(n, null, { width: W, height: H });
  const mid = b.hang.center ?? (b.hang.base != null ? b.hang.base + 14 : 58);
  const truth = {
    quad: [img(cx - 36, Math.min(100, mid + 30)), img(cx + 36, Math.min(100, mid + 30)), img(cx + 36, mid - 22), img(cx - 36, mid - 22)],
    anchors: [img(cx, mid)],
    // there is no person in these drawings: a custom 60 in line up the wall (the drawing's units are inches)
    ref: { a: img(cx + 30, mid - 20), b: img(cx + 30, mid + 20), kind: "custom", inches: 40 },
    ppiWall: s,
  };
  return { id: "fx-procedural-living", W, H, raw: svgText, truth, tags: ["living"], desc: `Procedural scene #${n} from lib/rooms rendered to JPEG (drawn, not a photo).` };
}

const fixtures = [livingFrontal(), cafeOblique(), galleryDoor(), proceduralLiving()];
for (const fx of fixtures) {
  let svg = fx.raw;
  if (!svg) svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fx.W}" height="${fx.H}" viewBox="0 0 ${fx.W} ${fx.H}">${fx.svg.join("")}</svg>`;
  let pipe = sharp(Buffer.from(svg));
  if (fx.raw) pipe = pipe.composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fx.W}" height="${fx.H}">${watermark(fx.W)}</svg>`), left: 0, top: 0 }]);
  await pipe.flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toFile(path.join(OUT, `${fx.id}.jpg`));
  const round = (p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  const truth = {
    ...fx.truth,
    quad: fx.truth.quad.map(round),
    anchors: fx.truth.anchors.map(round),
    ref: { ...fx.truth.ref, a: round(fx.truth.ref.a), b: round(fx.truth.ref.b) },
    ...(fx.truth.ref2 ? { ref2: { ...fx.truth.ref2, a: round(fx.truth.ref2.a), b: round(fx.truth.ref2.b) } } : {}),
  };
  const meta = {
    fixture: true,
    source: "Synthetic test fixture",
    note: "Drawn by scripts/scenes/make-fixtures.mjs for testing. NOT a photograph; never ship as a real scene.",
    description: fx.desc,
    tags: fx.tags,
    truth,
  };
  fs.writeFileSync(path.join(OUT, `${fx.id}.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`${fx.id}.jpg  ${fx.W}×${fx.H}  wall ppi at anchor ≈ ${truth.ppiWall.toFixed(3)}`);
  if (annotateIds.includes(fx.id)) {
    fs.mkdirSync(ANN, { recursive: true });
    const ann = {
      id: fx.id,
      version: 1,
      image: { w: fx.W, h: fx.H },
      status: "ok",
      quad: truth.quad,
      anchors: truth.anchors,
      ref: truth.ref,
      lens: null,
      tint: fx.id.includes("gallery") ? "#ecebe7" : "#ddd6ca",
      shadow: { angle: 70, strength: 0.5 },
      tags: fx.tags,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(ANN, `${fx.id}.json`), JSON.stringify(ann, null, 2) + "\n");
    console.log(`  wrote annotation scenes/annotations/${fx.id}.json (ground truth)`);
  }
}
