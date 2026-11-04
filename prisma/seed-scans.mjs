// Demo short link codes and scans. Called at the end of prisma/seed.mjs (after artists, artworks and orders exist).
// Maya gets 4 codes and ~1,200 scans over 60 days (weekends and Saturday market days busiest), and ~70% of her
// orders are credited to a code. Other artists get 1-2 codes with fewer scans. No real people: made-up visitors.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // same as lib/shortcode.ts: no 0/O/1/I/L
const DAY = 86400000;
const TZ_OFFSET_H = 5; // the demo artists' evenings, roughly US Eastern

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = rng(4247);
const pick = (list) => list[Math.floor(r() * list.length)];
/** Weighted pick from [[value, weight], ...] */
const wpick = (list) => { const total = list.reduce((s, [, w]) => s + w, 0); let x = r() * total; for (const [v, w] of list) { if ((x -= w) <= 0) return v; } return list[list.length - 1][0]; };
const vid = () => Array.from({ length: 22 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[Math.floor(r() * 64)]).join("");

const used = new Set();
function code() {
  for (;;) { const c = Array.from({ length: 4 }, () => ALPHABET[Math.floor(r() * ALPHABET.length)]).join(""); if (!used.has(c)) { used.add(c); return c; } }
}

// QR Studio designs (components/qr/card.ts Design), so "Card in QR Studio" reopens the same look.
const LOOK = {
  gallery: { preset: "gallery", format: "label", cta: "buy-print", dots: "rounded", eyes: "frame", fg: "#15161b", bg: "#ffffff", eye: "#2b37f0", tag: "#ffd43b" },
  market: { preset: "market", format: "tag", cta: "buy-painting", dots: "square", eyes: "rounded", fg: "#15161b", bg: "#ffffff", eye: "#ff5a36", tag: "#ff5a36" },
  poster: { preset: "poster", format: "poster", cta: "scan-buy", dots: "liquid", eyes: "frame", fg: "#2b37f0", bg: "#f2f3ec", eye: "same", tag: "#ffd43b" },
  sticker: { preset: "sticker", format: "sticker", cta: "scan-buy", dots: "dots", eyes: "circle", fg: "#15161b", bg: "#ffd43b", eye: "same", tag: "#15161b" },
};
const design = (look, extra = {}) => ({
  ...LOOK[look], ctaCustom: "Take me home", showTitle: true, showPrice: true, showBrand: true, logo: true,
  disc: 0, coupon: "", ev: "", evPrint: false, size: "medium", end: "never", ...extra,
});

const ASHEVILLE = [["Asheville", "NC", 60], ["Black Mountain", "NC", 6], ["Weaverville", "NC", 5], ["Hendersonville", "NC", 5], ["Charlotte", "NC", 4], ["Knoxville", "TN", 3], ["Greenville", "SC", 3], ["Atlanta", "GA", 2]];
const FAR = [["Asheville", "NC", 14], ["Brooklyn", "NY", 6], ["Austin", "TX", 4], ["Chicago", "IL", 4], ["Los Angeles", "CA", 4], ["Atlanta", "GA", 3], ["Durham", "NC", 3], ["Seattle", "WA", 3], ["Denver", "CO", 2], ["Toronto", "ON", 2, "CA"]];
const near = (city, state) => [[city, state, 70], ["Nearby", state, 0]];

/** A scan time on day d (0 = today, counting back), local hours weighted to the afternoon. */
function timeOn(d, hours) {
  const [h0, h1] = hours;
  const start = new Date(Date.now() - d * DAY);
  start.setUTCHours(0, 0, 0, 0);
  const h = h0 + (r() + r()) / 2 * (h1 - h0);
  const t = start.getTime() + (h + TZ_OFFSET_H) * 3600000;
  return new Date(Math.min(t, Date.now() - 60000));
}
const weekday = (d) => new Date(Date.now() - d * DAY - TZ_OFFSET_H * 3600000).getUTCDay(); // 0 Sun, 6 Sat

/**
 * Scans for one code. rate: average per day; dayWeight(d, wd) shapes it; places: [[city, region, weight, country?]].
 * Returns rows for ScanEvent.createMany. About 1 in 5 scans comes from someone who scanned before.
 */
function scansFor(qrCodeId, { days = 60, rate, dayWeight = () => 1, places, devices = [["phone", 88], ["tablet", 5], ["desktop", 7]], hours = [9, 21], unknownCity = 0.05, startDay = days }) {
  const rows = [], seen = [];
  for (let d = Math.min(days, startDay) - 1; d >= 0; d--) {
    const lambda = rate * dayWeight(d, weekday(d));
    // Poisson-ish: sum of a few uniforms around lambda
    let k = Math.max(0, Math.round(lambda + (r() - 0.5) * Math.sqrt(lambda + 1) * 2));
    for (let i = 0; i < k; i++) {
      const [city, region, , country] = wpick(places.map((p) => [p, p[2]]));
      const v = seen.length && r() < 0.2 ? pick(seen) : vid();
      if (!seen.includes(v)) seen.push(v);
      const noCity = r() < unknownCity || city === "Nearby";
      rows.push({ qrCodeId, createdAt: timeOn(d, hours), device: wpick(devices), city: noCity ? null : city, region: noCity ? null : region, country: noCity && r() < 0.5 ? null : country || "US", visitorId: v });
    }
  }
  return rows;
}

export async function seedScans(prisma) {
  await prisma.scanEvent.deleteMany();
  await prisma.qrCode.deleteMany();

  const artists = await prisma.artist.findMany({ where: { role: { not: "ADMIN" } }, select: { id: true, slug: true, artworks: { where: { status: "APPROVED" }, select: { id: true, title: true }, orderBy: { createdAt: "asc" } } } });
  const bySlug = Object.fromEntries(artists.map((a) => [a.slug, a]));
  const daysAgo = (n) => new Date(Date.now() - n * DAY);
  const allScans = [];
  const codesByArtist = {};

  async function make(artist, c, scanOpts) {
    const row = await prisma.qrCode.create({ data: { code: code(), artistId: artist.id, artworkId: c.artworkId ?? null, label: c.label, venue: c.venue ?? null, discountPct: c.discountPct ?? null, design: c.design ?? undefined, active: c.active ?? true, expiresAt: c.expiresAt ?? null, createdAt: c.createdAt } });
    (codesByArtist[artist.id] ||= []).push(row);
    if (scanOpts) allScans.push(...scansFor(row.id, scanOpts));
    return row;
  }

  // ---- Maya: 4 codes, ~1,200 scans ----
  const maya = bySlug.mayaokafor;
  if (maya) {
    const w = (t) => maya.artworks.find((a) => a.title === t)?.id ?? maya.artworks[0]?.id;
    const weekend = (d, wd) => (wd === 0 || wd === 6 ? 2.2 : wd === 5 ? 1.3 : 0.8);
    await make(maya, { label: "Lumen Café wall", venue: "Lumen Café", artworkId: w("Blue Ridge, Late"), design: design("gallery", { ev: "Lumen Café" }), createdAt: daysAgo(64) },
      { rate: 5.8, dayWeight: (d, wd) => weekend(d, wd) * (wd === 0 ? 1.15 : 1), places: ASHEVILLE, hours: [8, 18] });
    // River Arts Market runs Saturdays (and a holiday-season Sunday): big days, quiet weekdays.
    await make(maya, { label: "River Arts Market tags", venue: "River Arts Market", discountPct: 10, artworkId: w("Cold Mountain Road"), design: design("market", { disc: 10, coupon: "SCAN10", ev: "River Arts Market", evPrint: true }), createdAt: daysAgo(62) },
      { rate: 1, dayWeight: (d, wd) => (wd === 6 ? 46 : wd === 0 ? (d < 21 ? 14 : 3) : 0.6), places: ASHEVILLE, hours: [9, 16], devices: [["phone", 93], ["tablet", 4], ["desktop", 3]] });
    await make(maya, { label: "Instagram bio", design: design("sticker"), createdAt: daysAgo(66) },
      { rate: 2.8, dayWeight: (d, wd) => (wd === 0 || wd === 6 ? 1.3 : 1), places: FAR, hours: [7, 23], devices: [["phone", 72], ["tablet", 6], ["desktop", 22]], unknownCity: 0.08 });
    await make(maya, { label: "Studio door poster", venue: "Studio door", artworkId: w("French Broad, 6pm"), design: design("poster", { ev: "Open studio" }), createdAt: daysAgo(40) },
      { rate: 1.6, startDay: 40, dayWeight: weekend, places: ASHEVILLE, hours: [10, 19] });
  }

  // ---- Others: 1-2 codes, fewer scans ----
  const few = (d, wd) => (wd === 0 || wd === 6 ? 1.8 : 0.8);
  const juno = bySlug.junopark;
  if (juno) {
    await make(juno, { label: "Juniper Coffee", venue: "Juniper Coffee", artworkId: juno.artworks[0]?.id, design: design("gallery", { ev: "Juniper Coffee" }), createdAt: daysAgo(58) }, { rate: 2.1, dayWeight: few, places: near("Austin", "TX") });
    await make(juno, { label: "East Austin Studio Tour", venue: "East Austin Studio Tour", discountPct: 15, artworkId: juno.artworks[1]?.id, design: design("market", { disc: 15, ev: "East Austin Studio Tour", evPrint: true }), createdAt: daysAgo(30) }, { rate: 1.2, startDay: 30, dayWeight: few, places: near("Austin", "TX") });
  }
  const ines = bySlug.inesduarte;
  if (ines) await make(ines, { label: "Canyon Road gallery", venue: "Canyon Road", artworkId: ines.artworks[0]?.id, design: design("gallery", { ev: "Canyon Road" }), createdAt: daysAgo(55) }, { rate: 1.5, dayWeight: few, places: near("Santa Fe", "NM") });
  const caleb = bySlug.calebmoreno;
  if (caleb) {
    await make(caleb, { label: "Saturday Market pop-up", venue: "Portland Saturday Market", artworkId: caleb.artworks[0]?.id, design: design("market", { ev: "Portland Saturday Market", evPrint: true }), createdAt: daysAgo(50), expiresAt: daysAgo(15) },
      { rate: 1, startDay: 50, dayWeight: (d, wd) => (d < 15 ? 0 : wd === 6 ? 9 : 0.3), places: near("Portland", "OR") });
    await make(caleb, { label: "Instagram bio", design: design("sticker"), createdAt: daysAgo(45) }, { rate: 0.6, startDay: 45, places: near("Portland", "OR"), devices: [["phone", 75], ["desktop", 25]] });
  }
  const priya = bySlug.priyanair;
  if (priya) await make(priya, { label: "Studio wall", artworkId: priya.artworks[0]?.id, design: design("gallery"), createdAt: daysAgo(20) }, { rate: 0.5, startDay: 20, places: near("Asheville", "NC") });

  // ---- Credit orders to codes: ~70% of Maya's, ~45% of everyone else's ----
  // Each credited sale also gets the scan that led to it, a few minutes before the order.
  let credited = 0;
  for (const a of artists) {
    const codes = codesByArtist[a.id] || [];
    if (!codes.length) continue;
    const share = a.slug === "mayaokafor" ? 0.7 : 0.45;
    const items = await prisma.orderItem.findMany({ where: { artwork: { artistId: a.id }, order: { paymentStatus: "paid", kind: { not: "bulk" } } }, select: { id: true, artworkId: true, order: { select: { createdAt: true } } } });
    for (const it of items) {
      if (r() >= share) continue;
      const live = codes.filter((c) => c.createdAt <= it.order.createdAt && (!c.expiresAt || c.expiresAt > it.order.createdAt));
      const same = live.filter((c) => c.artworkId === it.artworkId);
      const page = live.filter((c) => !c.artworkId);
      // The market and café codes sell their own piece; the artist-page code sells anything.
      const c = same.length && (r() < 0.8 || !page.length) ? pick(same) : page.length ? pick(page) : live.length ? pick(live) : null;
      if (!c) continue;
      await prisma.orderItem.update({ where: { id: it.id }, data: { qrCodeId: c.id } });
      allScans.push({ qrCodeId: c.id, createdAt: new Date(it.order.createdAt.getTime() - (3 + r() * 37) * 60000), device: "phone", city: a.slug === "mayaokafor" ? "Asheville" : null, region: a.slug === "mayaokafor" ? "NC" : null, country: "US", visitorId: vid() });
      credited++;
    }
  }

  for (let i = 0; i < allScans.length; i += 1000) await prisma.scanEvent.createMany({ data: allScans.slice(i, i + 1000) });
  const mayaCodes = maya ? (codesByArtist[maya.id] || []).map((c) => c.id) : [];
  const mayaScans = allScans.filter((s) => mayaCodes.includes(s.qrCodeId)).length;
  console.log(`Seeded ${Object.values(codesByArtist).flat().length} short link codes, ${allScans.length} scans (Maya ${mayaScans}), ${credited} sales credited to codes.`);
}
