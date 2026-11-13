// Demo page views for Studio → Analytics. Called from prisma/seed.mjs after scans and orders exist.
// Every scan opens a page (same visitor id, so scans and views line up), plus visits from Instagram, search,
// email and the rest. Roughly 3-8 views per scan over the last 90 days. Made-up visitors only.

const DAY = 86400000;
const TZ_OFFSET_H = 5; // roughly US Eastern, like seed-scans.mjs

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = rng(9021);
const pick = (list) => list[Math.floor(r() * list.length)];
const wpick = (list) => { const total = list.reduce((s, [, w]) => s + w, 0); let x = r() * total; for (const [v, w] of list) { if ((x -= w) <= 0) return v; } return list[list.length - 1][0]; };
const vid = () => Array.from({ length: 22 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[Math.floor(r() * 64)]).join("");
const poisson = (lambda) => Math.max(0, Math.round(lambda + (r() - 0.5) * Math.sqrt(lambda + 1) * 2));
const weekday = (d) => new Date(Date.now() - d * DAY - TZ_OFFSET_H * 3600000).getUTCDay();

/** A time on day d (0 = today), local hours weighted to the middle of [h0, h1]. */
function timeOn(d, [h0, h1]) {
  const start = new Date(Date.now() - d * DAY);
  start.setUTCHours(0, 0, 0, 0);
  const h = h0 + (r() + r()) / 2 * (h1 - h0);
  return new Date(Math.min(start.getTime() + (h + TZ_OFFSET_H) * 3600000, Date.now() - 120000));
}

// source → [weight, referrer hosts (null = none sent), phone share, local hours, first page]
const SOURCES = {
  instagram: [30, [["l.instagram.com", 6], ["instagram.com", 3]], 0.93, [7, 23], "links"],
  direct: [16, [[null, 1]], 0.6, [8, 23], "artist"],
  search: [11, [["google.com", 8], ["bing.com", 1], ["duckduckgo.com", 1]], 0.5, [8, 22], "art"],
  tiktok: [8, [["tiktok.com", 1]], 0.96, [10, 24], "links"],
  facebook: [6, [["m.facebook.com", 3], ["l.facebook.com", 2], ["facebook.com", 1]], 0.8, [7, 22], "art"],
  pinterest: [6, [["pinterest.com", 3], ["pin.it", 1]], 0.7, [8, 23], "art"],
  email: [5, [["mail.google.com", 2], [null, 3]], 0.55, [6, 21], "art"],
  share: [4, [[null, 1]], 0.85, [9, 23], "art"],
  embed: [2, [[null, 1]], 0.3, [9, 20], "art"],
  "linktr.ee": [2, [["linktr.ee", 1]], 0.9, [9, 23], "artist"],
  "reddit.com": [1.5, [["reddit.com", 1]], 0.6, [10, 24], "art"],
  "t.co": [1, [["t.co", 1]], 0.8, [9, 23], "art"],
};
const SOURCE_LIST = Object.entries(SOURCES).map(([k, v]) => [k, v[0]]);

export async function seedViews(prisma) {
  await prisma.pageView.deleteMany();
  const artists = await prisma.artist.findMany({
    where: { role: { not: "ADMIN" } },
    select: {
      id: true, slug: true,
      artworks: { where: { status: "APPROVED", slug: { not: null } }, select: { id: true, slug: true, _count: { select: { OrderItem: true } } } },
      collections: { select: { slug: true } },
    },
  });
  const since = new Date(Date.now() - 90 * DAY);
  const rows = [];
  const summary = [];

  for (const a of artists) {
    if (!a.artworks.length) continue;
    const scans = await prisma.scanEvent.findMany({
      where: { qrCode: { artistId: a.id }, createdAt: { gte: since } },
      select: { createdAt: true, device: true, visitorId: true, qrCode: { select: { code: true, artworkId: true } } },
    });
    const before = rows.length;
    const artPath = (w) => `/@${a.slug}/art/${w.slug}`;
    // Pieces that sell get looked at more.
    const artWeights = a.artworks.map((w) => [w, 1 + 1.5 * w._count.OrderItem]);
    const browse = () => {
      const x = r();
      if (x < 0.62) return artPath(wpick(artWeights));
      if (x < 0.82) return `/@${a.slug}`;
      if (x < 0.9 && a.collections.length) return `/@${a.slug}/collections/${pick(a.collections).slug}`;
      return `/@${a.slug}/collections`;
    };
    /** One visit: a landing page and a few more, a minute or so apart. */
    const visit = (at, first, source, referrer, device, visitorId, artworkId) => {
      const pages = [first, ...Array.from({ length: wpick([[0, 45], [1, 28], [2, 15], [3, 8], [4, 4]]) }, browse)];
      const seen = new Set();
      let t = at.getTime();
      for (const path of pages) {
        if (seen.has(path)) continue; // the tracker counts a page once per visit
        seen.add(path);
        const art = path.includes("/art/") ? a.artworks.find((w) => artPath(w) === path) : null;
        rows.push({ path, artistId: a.id, artworkId: art?.id ?? (path === first ? artworkId ?? null : null), source, referrer, visitorId, device, createdAt: new Date(Math.min(t, Date.now() - 60000)) });
        t += (40 + r() * 200) * 1000;
      }
    };

    // QR: each scan lands on the code's piece (or the artist page), same visitor as the scan.
    for (const s of scans) {
      const w = s.qrCode.artworkId ? a.artworks.find((x) => x.id === s.qrCode.artworkId) : null;
      const device = s.device === "phone" ? "mobile" : s.device || "mobile";
      visit(new Date(s.createdAt.getTime() + 2000), w ? artPath(w) : `/@${a.slug}`, "qr", null, device, s.visitorId || vid(), w?.id);
    }

    // Everything else: about 2 visits per scan, a floor for artists with few codes, growing over the 90 days.
    const scanRate = scans.length / 90;
    const base = Math.max(0.6, scanRate * 2.1);
    const regulars = [];
    const viral = a.slug === "mayaokafor" ? new Set([33, 34, 12]) : new Set([Math.floor(r() * 80)]);
    for (let d = 89; d >= 0; d--) {
      const wd = weekday(d);
      const trend = 0.7 + 0.45 * ((89 - d) / 89);
      const weekly = wd === 0 || wd === 6 ? 1.25 : wd === 3 ? 1.05 : 0.92;
      const n = poisson(base * trend * weekly);
      const spike = viral.has(d) ? poisson(base * (d === 33 ? 5 : 2.5)) : 0;
      for (let i = 0; i < n + spike; i++) {
        const source = i >= n ? "instagram" : wpick(SOURCE_LIST);
        const [, hosts, phone, hours, firstKind] = SOURCES[source];
        const referrer = wpick(hosts);
        const r0 = r();
        const device = r0 < phone ? "mobile" : r0 < phone + (1 - phone) * 0.12 ? "tablet" : "desktop";
        const v = regulars.length && r() < 0.18 ? pick(regulars) : vid();
        if (regulars.length < 400) regulars.push(v);
        const first = firstKind === "links" && r() < 0.7 ? `/@${a.slug}/links` : firstKind === "artist" || (firstKind === "links") ? `/@${a.slug}` : artPath(wpick(artWeights));
        visit(timeOn(d, hours), first, source, referrer, device, v);
      }
    }
    const views = rows.length - before;
    summary.push(`${a.slug} ${views} views / ${scans.length} scans`);
  }

  rows.sort((x, y) => x.createdAt - y.createdAt);
  for (let i = 0; i < rows.length; i += 2000) await prisma.pageView.createMany({ data: rows.slice(i, i + 2000) });
  console.log(`Seeded ${rows.length} page views (${summary.join(", ")}).`);
}
