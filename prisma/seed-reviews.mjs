// Demo buyer reviews. Called at the end of prisma/seed.mjs (after artists, artworks and delivered orders exist).
// ~40 published reviews on delivered retail orders, mostly 4-5 dabs with a few 3s, a couple of wall photos
// (artwork images stand in for real photos), and replies from Maya on some of hers. Plus one review held as
// "flagged" so the admin queue has something in it. Some delivered orders stay unreviewed for testing the flow.

const DAY = 86400000;

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = rng(5150);

// Mirrors components/reviews/format.ts shortName and lib/reviews.ts cityFromAddress.
const shortName = (full) => { const p = full.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };
function cityOf(address) {
  let p = String(address || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (p.length >= 3 && !/\d/.test(p[p.length - 1]) && /\d/.test(p[p.length - 2])) p = p.slice(0, -1);
  return p.length >= 3 && !/\d/.test(p[p.length - 2]) ? p[p.length - 2] : null;
}

// {first} is the artist's first name. Empty strings are rating-only reviews.
const FIVE = [
  "Hung it over the couch the day it came. My partner keeps stopping to look at it.",
  "Colors are even better in person. That orange!",
  "Saw the original at the market and couldn't stop thinking about it. The print holds up, honestly can't tell from across the room.",
  "Packed really well, not a single ding. Looks great in the hallway.",
  "gift for my mom. she cried. in a good way",
  "Perfect size for above my desk. Makes video calls a lot nicer.",
  "It's the first thing I see in the morning and I'm not mad about it.",
  "Paper feels heavy and nice. Framed it myself and it looks like it cost three times what I paid.",
  "Grew up two subway stops from here. This one feels like home.",
  "Came in five days. Put it in the kitchen and the whole room feels warmer.",
  "Scanned the code at a coffee shop in Brooklyn on a whim. Best impulse buy of the year.",
  "So good. Already eyeing a second one for the bedroom.",
  "The blues are unreal.",
  "Exactly what I hoped for. Thank you {first}!",
  "Got the large. Worth it.",
  "My kid asked if we've been there. We haven't, but now we have to go.",
  "Second print from {first}. They look great next to each other.",
  "Our living room finally looks finished.",
  "Bought it for my new apartment and it's the thing everyone asks about.",
  "",
  "",
  "",
];
const FOUR = [
  "Lovely print. A touch darker than on my screen, but I think I like it more.",
  "Really happy with it. Took a little longer to arrive than I expected.",
  "Beautiful. Wish there was a square option, but that's on me.",
  "Great colors. The tube was a bit crushed in shipping but the print inside was fine.",
  "Looks great over the bed. Would love a matte paper option someday.",
  "Nice and vibrant. Only docking one because now I want it bigger.",
  "Solid. The frame shop guy said the paper was really good quality.",
  "",
];
const THREE = [
  "The print is nice but the greens came out a bit flat compared to the photo.",
  "It's fine. Smaller than I pictured, should have measured first.",
  "Pretty, but it took almost three weeks to get here.",
];

const REPLY = [
  "Thank you, {buyer}! Love where you put it.",
  "This made my week. Thanks for hanging it up!",
  "So glad it got there safe. Enjoy it!",
  "Thank you so much. That's exactly the light I was chasing.",
  "Ha, the large is my favorite too. Thanks {buyer}!",
];
const REPLY_PHOTO = "Thank you for the photo, {buyer}! It looks so good there.";
const REPLY_LOW = "Thanks for being honest, {buyer}. I'm talking to the printer about it. Email me if you'd like it redone.";

// How many reviews each artist gets (by delivered orders available), and the rating mix overall.
const QUOTA = { mayaokafor: 22, junopark: 9, inesduarte: 6, calebmoreno: 3 };
const RATINGS = [...Array(27).fill(5), ...Array(10).fill(4), ...Array(3).fill(3)];

export async function seedReviews(prisma) {
  await prisma.review.deleteMany();
  const items = await prisma.orderItem.findMany({
    where: { order: { kind: "retail", paymentStatus: "paid", shippingStatus: "delivered" }, artworkId: { not: null } },
    orderBy: { order: { createdAt: "asc" } },
    select: {
      id: true, artworkId: true,
      artwork: { select: { imageUrl: true, artistId: true, artist: { select: { slug: true, first_name: true } } } },
      order: { select: { createdAt: true, shippingName: true, shippingAddress: true } },
    },
  });

  // Pick per artist, spread across their delivered orders; the rest stay unreviewed for testing the flow.
  const chosen = [];
  for (const [slug, n] of Object.entries(QUOTA)) {
    const mine = items.filter((i) => i.artwork.artist.slug === slug);
    const step = Math.max(1, Math.floor(mine.length / n));
    for (let k = 0; k < mine.length && chosen.filter((c) => c.artwork.artist.slug === slug).length < n; k += step) chosen.push(mine[k]);
  }

  // Shuffle the ratings so the 3s land on different artists.
  const ratings = [...RATINGS].sort(() => r() - 0.5);
  const pools = { 5: [...FIVE], 4: [...FOUR], 3: [...THREE] };
  const take = (rating) => { const p = pools[rating]; if (!p.length) pools[rating] = [...{ 5: FIVE, 4: FOUR, 3: THREE }[rating]]; return pools[rating].splice(Math.floor(r() * pools[rating].length), 1)[0]; };
  const photoAt = new Set([2, 9, 23]); // a couple of wall photos
  let replies = 0;
  let mayaIndex = 0;

  const now = Date.now();
  const data = chosen.map((it, n) => {
    const rating = ratings[n % ratings.length];
    const first = it.artwork.artist.first_name || "you";
    const body = take(rating).replace("{first}", first);
    const delivered = it.order.createdAt.getTime() + 14 * DAY;
    const createdAt = new Date(Math.min(now - 3600e3, delivered + Math.floor(r() * 6 + 1) * DAY + Math.floor(r() * 12) * 3600e3));
    const buyerName = shortName(it.order.shippingName || "A buyer");
    const photoUrl = photoAt.has(n) && body ? it.artwork.imageUrl : null;
    // Maya replies to about half of hers, including every 3.
    let artistReply = null, artistReplyAt = null;
    if (it.artwork.artist.slug === "mayaokafor") {
      if (rating === 3 || photoUrl || mayaIndex++ % 2 === 0) {
        const first = buyerName.split(" ")[0];
        artistReply = (rating === 3 ? REPLY_LOW : photoUrl ? REPLY_PHOTO : REPLY[replies++ % REPLY.length]).replace("{buyer}", first);
        artistReplyAt = new Date(Math.min(now - 600e3, createdAt.getTime() + Math.floor(r() * 2 + 1) * DAY));
      }
    }
    return {
      orderItemId: it.id, artworkId: it.artworkId, artistId: it.artwork.artistId, rating, body,
      buyerName, buyerCity: cityOf(it.order.shippingAddress), photoUrl, status: "published", artistReply, artistReplyAt, createdAt,
    };
  });

  // One held for admin: it has a link in it.
  const spare = items.find((i) => !chosen.includes(i) && i.artwork.artist.slug === "junopark");
  if (spare) {
    data.push({
      orderItemId: spare.id, artworkId: spare.artworkId, artistId: spare.artwork.artistId, rating: 5,
      body: "Love it!! Also I paint too, check out my stuff at www.example-shop.com",
      buyerName: shortName(spare.order.shippingName || "A buyer"), buyerCity: cityOf(spare.order.shippingAddress), photoUrl: null,
      status: "flagged", createdAt: new Date(now - 2 * DAY),
    });
  }

  await prisma.review.createMany({ data });
  const published = data.filter((d) => d.status === "published");
  const avg = published.reduce((s, d) => s + d.rating, 0) / (published.length || 1);
  console.log(`Seeded ${published.length} reviews (avg ${avg.toFixed(1)}, ${published.filter((d) => d.photoUrl).length} photos, ${published.filter((d) => d.artistReply).length} replies) + ${data.length - published.length} flagged.`);
}
