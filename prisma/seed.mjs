// Local demo data. Run: pnpm db:seed  (wipes and refills the local database)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "artfinity123";

const ARTISTS = [
  { slug: "mayaokafor", artist_name: "Maya Okafor", first: "Maya", last: "Okafor", city: "Asheville", state: "NC", bio: "Painting the mountains the way they look at 6pm in October. Every print is made to order.", avatar: 1 },
  { slug: "junopark", artist_name: "Juno Park", first: "Juno", last: "Park", city: "Austin", state: "TX", bio: "Big flat color, small moments. Mostly gouache, mostly Texas.", avatar: 2 },
  { slug: "inesduarte", artist_name: "Ines Duarte", first: "Ines", last: "Duarte", city: "Santa Fe", state: "NM", bio: "Desert light and the colors that only show up after rain.", avatar: 3 },
  { slug: "calebmoreno", artist_name: "Caleb Moreno", first: "Caleb", last: "Moreno", city: "Portland", state: "OR", bio: "Coastlines and fog. Oil on panel.", avatar: 4 },
  { slug: "priyanair", artist_name: "Priya Nair", first: "Priya", last: "Nair", city: "Asheville", state: "NC", bio: "Figures, rivers and the space between them.", avatar: 5 },
];
const WORKS = {
  mayaokafor: ["Blue Ridge, Late", "Cold Mountain Road", "French Broad, 6pm", "Bather, Sliding Rock", "Hawksbill", "Second Frost", "Craggy Pinnacle"],
  junopark: ["Lady Bird Lake", "South Congress Noon", "Barton Springs", "Hill Country Drive", "Pecan Season"],
  inesduarte: ["After the Monsoon", "Canyon Road", "Sangre de Cristo", "Turquoise Trail", "Galisteo Basin", "Abiquiu Morning"],
  calebmoreno: ["Cannon Beach Fog", "Willamette Grey", "Haystack Rock", "Hood at Dusk", "Columbia Gorge"],
  priyanair: ["River Figure I", "Swimmers"],
};
const SENSITIVE = { "Bather, Sliding Rock": ["Nudity"] };

// mirrors lib/artwork_price.ts and lib/revenue.ts
const BASE = { small: 3499, medium: 4499, large: 6499, xl: 7999 };
const COST = { S: 1799, M: 2299, L: 2799, XL: 3699 };
const SIZE_KEY = { small: "S", medium: "M", large: "L", xl: "XL" };

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  await prisma.orderItem.deleteMany(); await prisma.order.deleteMany(); await prisma.payout.deleteMany();
  await prisma.passwordResetToken.deleteMany(); await prisma.artwork.deleteMany(); await prisma.artist.deleteMany();
  const hash = await bcrypt.hash(PASSWORD, 10);

  await prisma.artist.create({ data: { name: "Artfinity Admin", artist_name: "Artfinity Admin", email: "admin@artfinity.local", password: hash, phone: "", city: "Asheville", citySlug: "asheville", state: "NC", country: "US", slug: "artfinity-admin", role: "ADMIN" } });

  let img = 1; const r = rng(2026); const arts = [];
  for (const a of ARTISTS) {
    const artist = await prisma.artist.create({ data: {
      name: a.artist_name, first_name: a.first, last_name: a.last, artist_name: a.artist_name,
      email: `${a.first.toLowerCase()}@artfinity.local`, password: hash, phone: "", city: a.city, citySlug: slugify(a.city), state: a.state, country: "US",
      slug: a.slug, bio: a.bio, profileImage: `/seed/avatar-${a.avatar}.jpg`, venmoHandle: `@${a.slug}`,
    } });
    for (const [i, title] of WORKS[a.slug].entries()) {
      const markup = [1500, 1000, 2000, 500][i % 4];
      const art = await prisma.artwork.create({ data: {
        title, slug: `${slugify(title)}-${a.slug.slice(0, 3)}`, description: `${title}. Original by ${a.artist_name}.`,
        imageUrl: `/seed/art-${String(img++).padStart(2, "0")}.jpg`, artistId: artist.id, status: "APPROVED",
        markupSmall: markup, markupMedium: markup, markupLarge: markup + 500, markupXl: markup + 1000,
        sensitive: SENSITIVE[title] || [], createdAt: new Date(Date.now() - (40 - img) * 86400000),
      }, include: { artist: true } });
      arts.push(art);
    }
  }

  // 40 paid orders over the last 30 days, weighted toward Maya so her Studio has data
  const maya = arts.filter((x) => x.artist.slug === "mayaokafor");
  for (let n = 0; n < 40; n++) {
    const art = n < 23 ? maya[Math.floor(r() * 3)] : arts[Math.floor(r() * arts.length)];
    const size = ["small", "medium", "medium", "large", "xl"][Math.floor(r() * 5)];
    const markup = size === "large" ? art.markupLarge : size === "xl" ? art.markupXl : art.markupSmall;
    const unit = BASE[size] + markup, lineTotal = unit;
    const created = new Date(Date.now() - Math.floor(r() * 30) * 86400000 - Math.floor(r() * 36e6));
    const fee = Math.ceil(lineTotal * 0.029) + 30;
    await prisma.order.create({ data: {
      stripeSessionId: `seed_${n}`, email: `buyer${n}@example.com`, amountTotal: lineTotal, currency: "usd", paymentStatus: "paid",
      createdAt: created, shippingName: `Buyer ${n + 1}`, shippingAddress: "1 Main St, Asheville, NC 28801, US",
      shippingStatus: n % 3 === 0 ? "shipped" : "pending", receiptSentAt: created,
      items: { create: [{ artworkId: art.id, slug: art.slug, size: SIZE_KEY[size], unitPrice: unit, quantity: 1, lineTotal,
        title: art.title, artistName: art.artist.artist_name, imageUrl: art.imageUrl,
        printCost: COST[SIZE_KEY[size]], shippingCost: 0, laborCost: 0, websiteCost: fee + 100 }] },
    } });
  }
  console.log(`Seeded ${ARTISTS.length} artists, ${arts.length} artworks, 40 orders. Log in as maya@artfinity.local / ${PASSWORD} (admin: admin@artfinity.local)`);
}
main().finally(() => prisma.$disconnect());
