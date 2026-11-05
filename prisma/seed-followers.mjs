// Demo email followers and one sent newsletter. Called at the end of prisma/seed.mjs.
// Maya gets ~48 (enough to show "48 followers" on her page), the others fewer. Mostly confirmed,
// some joined at checkout with real seeded buyer emails, a few pending, a few unsubscribed.
import { randomBytes } from "crypto";

const DAY = 86400000;
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = rng(7171);
const token = () => randomBytes(24).toString("base64url");

const FIRST = ["Ada", "Ben", "Cleo", "Dev", "Eli", "Fern", "Gus", "Hana", "Ivy", "Jude", "Kit", "Lou", "Mae", "Nico", "Opal", "Pia", "Quin", "Rosa", "Sage", "Tess", "Uma", "Vic", "Wren", "Xavi", "Yara", "Zed"];
const LAST = ["Abbott", "Bell", "Cho", "Diaz", "Ellis", "Ford", "Gray", "Hale", "Ito", "James", "Khan", "Lowe", "Mora", "Nash", "Ortiz", "Pryor", "Reyes", "Shaw", "Tran", "Vale", "West", "Young"];
const DOMAINS = ["gmail.com", "icloud.com", "outlook.com", "yahoo.com", "proton.me", "fastmail.com"];

const PLAN = { mayaokafor: 48, junopark: 14, inesduarte: 9, calebmoreno: 5, priyanair: 2 };

export async function seedFollowers(prisma) {
  await prisma.newsletter.deleteMany();
  await prisma.follower.deleteMany();

  const artists = await prisma.artist.findMany({ where: { slug: { in: Object.keys(PLAN) } }, select: { id: true, slug: true } });
  let total = 0;
  for (const a of artists) {
    // Real buyers of this artist's work, for the "at checkout" rows.
    const orders = await prisma.order.findMany({
      where: { paymentStatus: "paid", items: { some: { artwork: { artistId: a.id } } } },
      select: { email: true, shippingName: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const buyers = Array.from(new Map(orders.map((o) => [o.email, o])).values());
    const rows = new Map();
    const want = PLAN[a.slug];

    for (const b of buyers.slice(0, Math.round(want * 0.3))) {
      rows.set(b.email, { email: b.email, name: b.shippingName, source: "checkout", createdAt: b.createdAt, confirmed: true });
    }
    let n = 0;
    while (rows.size < want) {
      const f = FIRST[Math.floor(r() * FIRST.length)], l = LAST[Math.floor(r() * LAST.length)];
      const email = `${f}.${l}${n++ % 3 ? Math.floor(r() * 90 + 10) : ""}@${DOMAINS[Math.floor(r() * DOMAINS.length)]}`.toLowerCase();
      if (rows.has(email)) continue;
      const roll = r();
      const source = roll < 0.68 ? "page" : roll < 0.88 ? "links" : "import";
      rows.set(email, {
        email,
        name: r() < 0.4 ? `${f} ${l}` : null,
        source,
        createdAt: new Date(Date.now() - Math.floor(r() * 75) * DAY - Math.floor(r() * 8e7)),
        // Page and links follows wait for the confirm click; about 1 in 6 hasn't yet.
        confirmed: source === "import" || r() < 0.83,
      });
    }

    const list = Array.from(rows.values());
    const data = list.map((x, i) => ({
      artistId: a.id,
      email: x.email,
      name: x.name,
      source: x.source,
      token: token(),
      createdAt: x.createdAt,
      confirmedAt: x.confirmed ? new Date(x.createdAt.getTime() + Math.floor(r() * 3e6) + 60000) : null,
      // Every 9th confirmed follower has since unsubscribed.
      unsubscribedAt: x.confirmed && i % 9 === 8 ? new Date(Math.min(Date.now() - DAY, x.createdAt.getTime() + 20 * DAY)) : null,
    }));
    await prisma.follower.createMany({ data });
    total += data.length;
  }

  // One newsletter Maya sent a couple of weeks ago, with two of her pieces.
  const maya = artists.find((a) => a.slug === "mayaokafor");
  if (maya) {
    const pieces = await prisma.artwork.findMany({ where: { artistId: maya.id, title: { in: ["Second Frost", "Craggy Pinnacle"] } }, select: { id: true } });
    const sentAt = new Date(Date.now() - 12 * DAY);
    const recipients = await prisma.follower.count({ where: { artistId: maya.id, confirmedAt: { not: null, lt: sentAt } } });
    await prisma.newsletter.create({ data: {
      artistId: maya.id,
      subject: "Two new ones from the ridge",
      body: "Hi,\n\nOctober finally showed up. I spent three cold mornings up on Craggy with a thermos and too many brushes, and came home with two paintings I'm really happy with.\n\n**Second Frost** is the river the morning after the first hard frost. **Craggy Pinnacle** is the view at 6pm, the way it looks for about four minutes.\n\nPrints are made to order and ship free in the US.\n\nThanks for following,\nMaya",
      artworkIds: pieces.map((p) => p.id),
      sentAt,
      recipients,
      createdAt: new Date(sentAt.getTime() - 3600000),
    } });
  }
  console.log(`Seeded ${total} followers and 1 newsletter.`);
}
