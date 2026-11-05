// Local demo data. Run: pnpm db:seed  (wipes and refills the local database)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "artfinity123";

const ARTISTS = [
  { slug: "mayaokafor", verified: "VERIFIED", artist_name: "Maya Okafor", first: "Maya", last: "Okafor", city: "Asheville", state: "NC", bio: "Painting the mountains the way they look at 6pm in October. Every print is made to order.", avatar: 1 },
  { slug: "junopark", verified: "PENDING", artist_name: "Juno Park", first: "Juno", last: "Park", city: "Austin", state: "TX", bio: "Big flat color, small moments. Mostly gouache, mostly Texas.", avatar: 2 },
  { slug: "inesduarte", verified: "VERIFIED", artist_name: "Ines Duarte", first: "Ines", last: "Duarte", city: "Santa Fe", state: "NM", bio: "Desert light and the colors that only show up after rain.", avatar: 3 },
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
// Print sizes each file is sharp enough for. These two are smaller files, so XL is hidden from buyers.
const ALL_SIZES = ["small", "medium", "large", "xl"];
const PRINTABLE = { "Second Frost": ["small", "medium", "large"], "Haystack Rock": ["small", "medium", "large"] };

// mirrors lib/artwork_price.ts and lib/revenue.ts
const BASE = { small: 3499, medium: 4499, large: 6499, xl: 7999 };
const COST = { S: 1799, M: 2299, L: 2799, XL: 3699 };
const SIZE_KEY = { small: "S", medium: "M", large: "L", xl: "XL" };

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");


// Made-up buyers with real-looking names and cities. Some buy again, so the Customers page shows repeat buyers.
const BUYERS = [
  ["Ava Thompson", "Asheville, NC 28801"], ["Marcus Lee", "Charlotte, NC 28202"], ["Sofia Ramirez", "Austin, TX 78704"],
  ["Ethan Brooks", "Durham, NC 27701"], ["Lena Fischer", "Portland, OR 97214"], ["Noah Patel", "Atlanta, GA 30307"],
  ["Grace Kim", "Brooklyn, NY 11211"], ["Oliver Grant", "Denver, CO 80205"], ["Maya Chen", "Seattle, WA 98122"],
  ["Jonah Reed", "Nashville, TN 37206"], ["Isabel Cruz", "Santa Fe, NM 87501"], ["Theo Walsh", "Boston, MA 02118"],
  ["Hannah Price", "Raleigh, NC 27601"], ["Luca Moretti", "Chicago, IL 60622"], ["Zoe Adams", "Asheville, NC 28806"],
  ["Caleb Ortiz", "San Diego, CA 92104"], ["Nora Quinn", "Savannah, GA 31401"], ["Felix Wright", "Austin, TX 78702"],
  ["Ruby Hayes", "Greenville, SC 29601"], ["Sam Okoro", "Philadelphia, PA 19123"], ["Iris Novak", "Minneapolis, MN 55408"],
  ["Diego Alvarez", "Phoenix, AZ 85004"], ["June Park", "Richmond, VA 23220"], ["Owen Murphy", "Knoxville, TN 37902"],
  ["Clara Dunn", "Portland, ME 04101"], ["Ari Cohen", "Los Angeles, CA 90026"], ["Mila Ivanova", "Boulder, CO 80302"],
  ["Ben Carter", "Asheville, NC 28803"], ["Elena Rossi", "Charleston, SC 29401"], ["Kai Nakamura", "Oakland, CA 94612"],
];
const STREETS = ["Oak St", "Maple Ave", "River Rd", "Pine St", "Lark Ln", "Elm Ct", "Cedar Ave", "Hill St"];

async function main() {
  await prisma.collectionItem.deleteMany(); await prisma.collection.deleteMany();
  await prisma.message.deleteMany(); await prisma.emailTemplate.deleteMany(); await prisma.artistLink.deleteMany();
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
      verification: a.verified || "NONE",
      verifiedAt: a.verified === "VERIFIED" ? new Date(Date.now() - 20 * 86400000) : null,
      verificationRequestedAt: a.verified ? new Date(Date.now() - 25 * 86400000) : null,
      verificationEvidence: a.verified ? { instagram: `https://instagram.com/${a.slug}`, note: "Studio photos and my Instagram." } : undefined,
      links: { create: [
        { kind: "instagram", url: `https://instagram.com/${a.slug}`, position: 0 },
        { kind: "tiktok", url: `https://tiktok.com/@${a.slug}`, position: 1 },
        { kind: "website", url: `https://${a.slug}.art`, label: "My website", position: 2 },
        { kind: "custom", url: `https://example.com/${a.slug}/newsletter`, label: "Studio newsletter", position: 3 },
      ] },
    } });
    for (const [i, title] of WORKS[a.slug].entries()) {
      const markup = [1500, 1000, 2000, 500][i % 4];
      const art = await prisma.artwork.create({ data: {
        title, slug: `${slugify(title)}-${a.slug.slice(0, 3)}`, description: `${title}. Original by ${a.artist_name}.`,
        imageUrl: `/seed/art-${String(img++).padStart(2, "0")}.jpg`, artistId: artist.id, status: "APPROVED",
        markupSmall: markup, markupMedium: markup, markupLarge: markup + 500, markupXl: markup + 1000,
        sensitive: SENSITIVE[title] || [], createdAt: new Date(Date.now() - (40 - img) * 86400000),
        printableSizes: PRINTABLE[title] || ALL_SIZES, ownershipConfirmedAt: new Date(Date.now() - (40 - img) * 86400000),
      }, include: { artist: true } });
      arts.push(art);
    }
  }

  // Maya: two collections and one limited edition (Hawksbill, edition of 25)
  const mayaArts = arts.filter((x) => x.artist.slug === "mayaokafor");
  const mayaId = mayaArts[0].artistId;
  const pick = (titles) => titles.map((t) => mayaArts.find((a) => a.title === t)).filter(Boolean);
  const cols = [
    { title: "Blue Ridge series", slug: "blue-ridge-series", description: "Six o'clock light on the ridgelines.", works: pick(["Blue Ridge, Late", "Craggy Pinnacle", "Hawksbill", "Cold Mountain Road"]) },
    { title: "Rivers", slug: "rivers", description: "The French Broad, mostly.", works: pick(["French Broad, 6pm", "Second Frost"]) },
  ];
  for (const [ci, c] of cols.entries()) {
    await prisma.collection.create({ data: { artistId: mayaId, title: c.title, slug: c.slug, description: c.description, position: ci, coverArtworkId: c.works[0]?.id,
      items: { create: c.works.map((w, i) => ({ artworkId: w.id, position: i })) } } });
  }
  const hawk = mayaArts.find((a) => a.title === "Hawksbill");
  if (hawk) await prisma.artwork.update({ where: { id: hawk.id }, data: { editionSize: 25 } });

  // 100 paid orders over the last 60 days, spread so every medal level shows:
  // Maya 55 (gold), Juno 27 (silver), Ines 12 (bronze), Caleb 6, Priya 0.
  const by = (slug) => arts.filter((x) => x.artist.slug === slug);
  const plan = [...Array(55).fill("mayaokafor"), ...Array(27).fill("junopark"), ...Array(12).fill("inesduarte"), ...Array(6).fill("calebmoreno")];
  for (let n = 0; n < plan.length; n++) {
    const pool = by(plan[n]);
    const art = pool[Math.floor(r() * (plan[n] === "mayaokafor" ? 3 : pool.length))];
    const rolled = ["small", "medium", "medium", "large", "xl"][Math.floor(r() * 5)];
    const size = art.printableSizes.includes(rolled) ? rolled : "large";
    const markup = size === "large" ? art.markupLarge : size === "xl" ? art.markupXl : art.markupSmall;
    const unit = BASE[size] + markup, lineTotal = unit;
    const created = new Date(Date.now() - Math.floor(r() * 60) * 86400000 - Math.floor(r() * 36e6));
    const fee = Math.ceil(lineTotal * 0.029) + 30;
    await prisma.order.create({ data: {
      // ~1 in 3 orders comes from a returning buyer
      ...(() => {
        const bi = n % 3 === 0 ? Math.floor(r() * 8) : Math.floor(r() * BUYERS.length);
        const [name, place] = BUYERS[bi];
        const days = (Date.now() - created.getTime()) / 86400000;
        const status = days > 14 ? "delivered" : days > 5 ? "shipped" : "pending";
        return {
          stripeSessionId: `seed_${n}`, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
          amountTotal: lineTotal, currency: "usd", paymentStatus: "paid", createdAt: created,
          shippingName: name, shippingAddress: `${10 + bi * 7} ${STREETS[bi % STREETS.length]}, ${place.replace(/ (\d{5})$/, " $1")}, US`,
          shippingStatus: status, sentToPrinter: status !== "pending" || days > 2, receiptSentAt: created,
        };
      })(),
      items: { create: [{ artworkId: art.id, slug: art.slug, size: SIZE_KEY[size], unitPrice: unit, quantity: 1, lineTotal,
        title: art.title, artistName: art.artist.artist_name, imageUrl: art.imageUrl,
        printCost: COST[SIZE_KEY[size]], shippingCost: 0, laborCost: 0, websiteCost: fee + 100 }] },
    } });
  }
  console.log(`Seeded ${ARTISTS.length} artists, ${arts.length} artworks, ${plan.length} orders. Log in as maya@artfinity.local / ${PASSWORD} (admin: admin@artfinity.local)`);

  // Short link codes and scans, with some orders credited to codes (prisma/seed-scans.mjs)
  const { seedScans } = await import("./seed-scans.mjs");
  await seedScans(prisma);

  // Buyer reviews on delivered orders, with some artist replies (prisma/seed-reviews.mjs)
  const { seedReviews } = await import("./seed-reviews.mjs");
  await seedReviews(prisma);

  const { seedPayouts } = await import("./seed-payouts.mjs");
  await seedPayouts(prisma);

  // Image fingerprints for duplicate detection (lib/imageHash.ts). The seed images are distinct: the closest
  // pair of public/seed/art-*.jpg is 10 bits apart (15 among the 25 used), well over the threshold of 6.
  await import("../scripts/backfill-image-hashes.mjs");

  // Page views from QR scans, Instagram, search and the rest, for Studio → Analytics (prisma/seed-views.mjs)
  const { seedViews } = await import("./seed-views.mjs");
  await seedViews(prisma);

  // Email followers (page, links, checkout, a few unsubscribed) and one sent newsletter (prisma/seed-followers.mjs)
  const { seedFollowers } = await import("./seed-followers.mjs");
  await seedFollowers(prisma);
}
main().finally(() => prisma.$disconnect());
