// Generates placeholder "paintings" for local seed data: node scripts/gen-seed-images.mjs
import sharp from "sharp";
import fs from "fs";
import path from "path";

const OUT = path.join(process.cwd(), "public", "seed");
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PALS = [
  ["#2b3a67", "#e8a87c", "#f6d6ad", "#3e6259", "#c4553f"], ["#0d3b66", "#faf0ca", "#f4d35e", "#ee964b", "#f95738"],
  ["#283618", "#606c38", "#fefae0", "#dda15e", "#bc6c25"], ["#1b264f", "#274690", "#f5f3f5", "#e9c46a", "#576ca8"],
  ["#5f0f40", "#9a031e", "#fb8b24", "#e36414", "#0f4c5c"], ["#22333b", "#eae0d5", "#c6ac8f", "#5e503f", "#a9927d"],
  ["#003049", "#d62828", "#f77f00", "#fcbf49", "#eae2b7"]
];
function landscape(seed, w, h) {
  const r = rng(seed), P = PALS[seed % PALS.length], pick = () => P[Math.floor(r() * P.length)];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><filter id="t"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .08 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs><rect width="${w}" height="${h}" fill="${P[2]}"/>`;
  s += `<circle cx="${w * (0.2 + r() * 0.6)}" cy="${h * (0.15 + r() * 0.2)}" r="${w * (0.1 + r() * 0.1)}" fill="${P[4]}"/>`;
  const layers = 3 + Math.floor(r() * 2);
  for (let i = 0; i < layers; i++) {
    const base = h * (0.42 + i * (0.5 / layers)); let d = `M0 ${h} L0 ${base}`;
    for (let k = 1; k <= 5; k++) { const x = (w / 5) * k, cx = x - w / 10; d += ` Q${cx} ${base - r() * h * 0.16 + h * 0.04} ${x} ${base - r() * h * 0.05}`; }
    d += ` L${w} ${h} Z`;
    s += `<path d="${d}" fill="${i === layers - 1 ? P[0] : (i % 2 ? P[3] : pick())}" opacity="${0.82 + i * 0.05}"/>`;
  }
  if (r() > 0.4) s += `<path d="M${w * .35} ${h} C ${w * .5} ${h * .8}, ${w * .4} ${h * .7}, ${w * .55} ${h * .62}" stroke="${P[1]}" stroke-width="${w * .035}" fill="none" stroke-linecap="round"/>`;
  s += `<rect width="${w}" height="${h}" filter="url(#t)"/>`;
  return s + "</svg>";
}
function figure(seed, w, h) { // abstract figure study, used for the "sensitive" example
  const r = rng(seed);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#e9d8c4"/><rect y="${h * .62}" width="${w}" height="${h * .38}" fill="#6f8f8a"/>
  <ellipse cx="${w * .5}" cy="${h * .22}" rx="${w * .08}" ry="${w * .1}" fill="#c98b6b"/><path d="M${w * .38} ${h * .32} Q${w * .5} ${h * .28} ${w * .62} ${h * .32} L${w * .66} ${h * .62} Q${w * .5} ${h * .7} ${w * .34} ${h * .62} Z" fill="#d79a78"/>
  <path d="M${w * .34} ${h * .62} Q${w * .2} ${h * .8} ${w * .28} ${h * .95}" stroke="#d79a78" stroke-width="${w * .07}" fill="none" stroke-linecap="round"/><path d="M${w * .66} ${h * .62} Q${w * .78} ${h * .8} ${w * .7} ${h * .95}" stroke="#d79a78" stroke-width="${w * .07}" fill="none" stroke-linecap="round"/>
  <circle cx="${w * (.2 + r() * .1)}" cy="${h * .12}" r="${w * .06}" fill="#f3b45b"/></svg>`;
}
const jobs = [];
for (let i = 1; i <= 30; i++) jobs.push([`art-${String(i).padStart(2, "0")}.jpg`, i === 4 ? figure(41, 1200, 1500) : landscape(i * 7 + 3, 1200, 1500)]);
for (let i = 1; i <= 6; i++) jobs.push([`avatar-${i}.jpg`, landscape(i * 31, 400, 400)]);
for (const [name, svg] of jobs) await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(path.join(OUT, name));
console.log("wrote", jobs.length, "images to", OUT);
