// WHAT THIS PROTECTS: the money path of a print sale, start to finish, without calling Stripe or a real database.
// It checks that (1) the price a buyer is charged always comes from the artwork's price in our database, never from
// whatever the browser sends; (2) the line items we hand Stripe carry everything the order webhook needs; (3) when
// Stripe reports a paid checkout, we record exactly one order with the right items, totals, costs and artist share;
// and (4) when Stripe sends the same "paid" message twice (it does retry), no second order or duplicate prints appear.
// If one of these fails on a pull request, don't merge it: buyers could be charged wrongly or artists paid wrongly.
//
// Run: pnpm test (all tests) or pnpm test:checkout. The database is a small in-memory stand-in (fakeDb below).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { priceLine, readCartItem, stripeLineItem } from "./checkoutLines.ts";
import { recordCheckoutOrder } from "./checkoutOrder.ts";
import { calcItemProfitCents, COSTS, getArtistSplit } from "./revenue.ts";
import { basePrices, framePrices } from "./artwork_price.ts";
import { PRO } from "./plans.ts";

const BASE = "https://shop.example.com";
const ORDER_DATE = new Date("2026-11-02T15:00:00Z");
const DAY = 86400000;

// ---- Test data, shaped like the database rows the checkout route loads ----------------------------------------
const artists = [
  { id: "artist_free", plan: "FREE", proUntil: null },
  { id: "artist_inf", plan: "PRO", proUntil: new Date(ORDER_DATE.getTime() + 30 * DAY) }, // Infinity, active
];
const nightMarket = {
  id: "art_night", slug: "night-market", title: "Night Market", imageUrl: "/uploads/night.jpg", artistId: "artist_free",
  editionSize: null, markupSmall: 0, markupMedium: 1500, markupLarge: 2500, markupXl: 0,
  artist: { name: "maya", artist_name: "Maya Chen" },
};
const harbor = {
  id: "art_harbor", slug: "harbor-dawn", title: "Harbor at Dawn", imageUrl: "https://cdn.example.com/harbor.jpg", artistId: "artist_inf",
  editionSize: 50, markupSmall: 0, markupMedium: 0, markupLarge: 1000, markupXl: 0,
  artist: { name: "lee", artist_name: null },
};
const noScan = { discountPct: 0, venue: null, qrCodeId: null };

/** Just enough of Prisma for recordCheckoutOrder, kept in memory. */
function fakeDb({ soldBefore = {} } = {}) {
  const orders = [];
  const items = [];
  const db = {
    orders,
    items,
    order: {
      async upsert({ where, update, create }) {
        const found = orders.find((o) => o.stripeSessionId === where.stripeSessionId);
        if (found) return Object.assign(found, update);
        const o = { id: `order_${orders.length + 1}`, createdAt: ORDER_DATE, adminNotificationSentAt: null, artistNotificationsSentAt: null, receiptSentAt: null, kind: "retail", ...create };
        orders.push(o);
        return o;
      },
    },
    orderItem: {
      async count({ where }) { return items.filter((i) => i.orderId === where.orderId).length; },
      async createMany({ data }) { items.push(...data); return { count: data.length }; },
      // Prints already sold per artwork (lib/editions.ts soldByArtwork)
      async groupBy({ where }) { return where.artworkId.in.map((id) => ({ artworkId: id, _sum: { quantity: soldBefore[id] ?? 0 } })); },
      async aggregate() { return { _sum: { quantity: 0 } }; },
    },
    artist: { async findMany({ where }) { return artists.filter((a) => where.id.in.includes(a.id)); } },
    // The edition lock (SELECT "editionSize", title FROM "Artwork" WHERE id = … FOR UPDATE)
    async $queryRaw(_sql, id) {
      const a = [nightMarket, harbor].find((x) => x.id === id);
      return a ? [{ editionSize: a.editionSize, title: a.title }] : [];
    },
    async $transaction(fn) { return fn(db); },
  };
  return db;
}

/** What Stripe gives back from listLineItems(expand: price.product) for the line items we created the session with. */
function asStripeLineItems(params) {
  return {
    data: params.map((p, i) => ({
      id: `li_${i}`, object: "item", quantity: p.quantity, description: p.price_data.product_data.name,
      price: { unit_amount: p.price_data.unit_amount, product: { id: `prod_${i}`, metadata: p.price_data.product_data.metadata } },
    })),
  };
}

function paidSession(params, extra = {}) {
  return {
    id: "cs_test_a1", object: "checkout.session", mode: "payment", payment_status: "paid", currency: "usd",
    amount_total: params.reduce((n, p) => n + p.price_data.unit_amount * p.quantity, 0),
    metadata: { orderId: "cabcdefghijklmnopqrstuvwx", buyerEmail: "ana@example.com" },
    collected_information: { shipping_details: { name: "Ana Diaz", address: { line1: "12 Orchard St", city: "New York", state: "NY", postal_code: "10002", country: "US" } } },
    ...extra,
  };
}

// ---- 1. Pricing: from the database only -------------------------------------------------------------------
test("the charged price comes from the artwork in the database, not from the cart", () => {
  // A tampered cart: its own price, title, artist and a 90% discount. Only slug, size, frame and quantity are read.
  const cartItem = {
    quantity: 2,
    product: { slug: " night-market ", selectedSize: "Medium", frameChosen: true, frameColor: "white", price: 1, unitPrice: 1, list: 1, unit: 1, title: "Free print", artistId: "artist_evil" },
  };
  const pick = readCartItem(cartItem);
  assert.equal(pick.slug, "night-market");
  assert.equal(pick.size, "medium");
  const line = priceLine(nightMarket, pick, noScan);

  const expected = basePrices.medium + nightMarket.markupMedium + framePrices.medium; // base + artist's markup + frame
  assert.equal(line.list, expected);
  assert.equal(line.unit, expected);

  const li = stripeLineItem(line, BASE);
  assert.equal(li.price_data.unit_amount, expected);
  assert.equal(li.price_data.currency, "usd");
  assert.equal(li.quantity, 2);
  const meta = li.price_data.product_data.metadata;
  assert.equal(meta.title, "Night Market");
  assert.equal(meta.artistId, "artist_free");
  assert.equal(meta.artworkId, "art_night");
  assert.equal(meta.listPrice, String(expected));
  assert.equal(meta.frameChosen, "true");
  assert.equal(meta.frameColor, "white");
  assert.match(li.price_data.product_data.name, /Night Market by Maya Chen, Medium/);
  assert.deepEqual(li.price_data.product_data.images, [`${BASE}/uploads/night.jpg`]);
});

test("cart lines that can't be priced are dropped, and quantities stay between 1 and 10", () => {
  assert.equal(readCartItem({ product: { slug: "night-market", selectedSize: "poster" } }), null);
  assert.equal(readCartItem({ product: { slug: "", selectedSize: "small" } }), null);
  assert.equal(readCartItem(null), null);
  assert.equal(readCartItem({ quantity: 500, product: { slug: "a", selectedSize: "small" } }).quantity, 10);
  assert.equal(readCartItem({ quantity: -3, product: { slug: "a", selectedSize: "small" } }).quantity, 1);
  assert.equal(readCartItem({ quantity: "abc", product: { slug: "a", selectedSize: "small" } }).quantity, 1);
  // A frame colour we don't sell, or a colour without a frame, is ignored.
  assert.equal(readCartItem({ product: { slug: "a", selectedSize: "small", frameChosen: true, frameColor: "gold" } }).frameColor, null);
  assert.equal(readCartItem({ product: { slug: "a", selectedSize: "small", frameChosen: false, frameColor: "black" } }).frameColor, null);
});

test("a checked scan discount comes off the database price, and the list price is kept for the record", () => {
  const line = priceLine(harbor, readCartItem({ product: { slug: "harbor-dawn", selectedSize: "large" } }), { discountPct: 10, venue: "Brooklyn Flea", qrCodeId: "qr_1" });
  const list = basePrices.large + harbor.markupLarge;
  assert.equal(line.list, list);
  assert.equal(line.unit, Math.round(list * 0.9));
  const li = stripeLineItem(line, BASE);
  assert.equal(li.price_data.unit_amount, Math.round(list * 0.9), "Stripe charges the discounted price");
  const meta = li.price_data.product_data.metadata;
  assert.equal(meta.discountPct, "10");
  assert.equal(meta.listPrice, String(list));
  assert.equal(meta.venue, "Brooklyn Flea");
  assert.equal(meta.qrCodeId, "qr_1");
});

// ---- 2. The webhook: recording the paid order ----------------------------------------------------------------
function twoLineCheckout() {
  const a = priceLine(nightMarket, readCartItem({ quantity: 2, product: { slug: "night-market", selectedSize: "medium" } }), noScan);
  const b = priceLine(harbor, readCartItem({ product: { slug: "harbor-dawn", selectedSize: "large", frameChosen: true, frameColor: "natural" } }), { discountPct: 0, venue: null, qrCodeId: "qr_9" });
  return [a, b].map((l) => stripeLineItem(l, BASE));
}

test("a paid checkout records one order with the right items, costs and artist shares", async () => {
  const params = twoLineCheckout();
  const db = fakeDb({ soldBefore: { art_harbor: 3 } });
  const session = paidSession(params);
  const order = await recordCheckoutOrder(db, session, { buyerEmail: "ana@example.com", bulk: null, listLineItems: async () => asStripeLineItems(params) });

  assert.equal(db.orders.length, 1);
  assert.equal(order.id, "cabcdefghijklmnopqrstuvwx", "uses the order id made with the session (its code is on the card statement)");
  assert.equal(order.stripeSessionId, "cs_test_a1");
  assert.equal(order.amountTotal, session.amount_total);
  assert.equal(order.paymentStatus, "paid");
  assert.equal(order.email, "ana@example.com");
  assert.equal(order.shippingName, "Ana Diaz");
  assert.equal(order.shippingAddress, "12 Orchard St, New York, NY 10002, US");

  assert.equal(db.items.length, 2);
  const [a, b] = db.items;

  // Line 1: Night Market, Medium unframed × 2, Free artist.
  const aUnit = basePrices.medium + nightMarket.markupMedium;
  assert.equal(a.orderId, order.id);
  assert.equal(a.artworkId, "art_night");
  assert.equal(a.size, "M");
  assert.equal(a.unitPrice, aUnit);
  assert.equal(a.quantity, 2);
  assert.equal(a.lineTotal, aUnit * 2);
  assert.equal(a.frameChosen, false);
  assert.equal(a.frameColor, null);
  assert.equal(a.title, "Night Market");
  assert.equal(a.artistName, "Maya Chen");
  assert.equal(a.artistSplit, getArtistSplit(ORDER_DATE));
  assert.equal(a.editionNumber, null, "open edition: no number");
  // Costs worked out by hand from lib/revenue.ts COSTS: two unframed Medium prints, card fee on the line, hosting per print.
  assert.equal(a.printCost, COSTS.ITEM.UNFRAMED.M * 2);
  assert.equal(a.websiteCost, Math.ceil(a.lineTotal * COSTS.STRIPE_PERCENT) + COSTS.STRIPE_FIXED + COSTS.HOSTING_PER_ITEM * 2);

  // Line 2: Harbor at Dawn, Large, natural frame, Infinity artist, limited edition with 3 sold, came through a QR code.
  assert.equal(b.size, "L");
  assert.equal(b.unitPrice, basePrices.large + harbor.markupLarge + framePrices.large);
  assert.equal(b.frameChosen, true);
  assert.equal(b.frameColor, "natural");
  assert.equal(b.artistName, "lee", "no display name: falls back to the account name");
  assert.equal(b.artistSplit, PRO.split, "Infinity artists get the Infinity split");
  assert.ok(b.artistSplit > a.artistSplit);
  assert.equal(b.editionNumber, 4, "next number after the 3 already sold");
  assert.equal(b.qrCodeId, "qr_9");
  assert.equal(b.printCost, COSTS.ITEM.FRAMED.L);

  // What admin and payouts later read from these rows adds up: every cent of profit goes to the artist or Artfinity.
  for (const it of db.items) {
    const p = calcItemProfitCents({ lineTotal: it.lineTotal, size: it.size, frameChosen: it.frameChosen, quantity: it.quantity, orderDate: ORDER_DATE, artistSplit: it.artistSplit });
    assert.equal(p.printCost, it.printCost);
    assert.equal(p.websiteCost, it.websiteCost);
    assert.equal(p.profit, Math.max(0, it.lineTotal - it.printCost - it.laborCost - it.websiteCost));
    assert.equal(p.artistShare + p.companyShare, p.profit);
    assert.equal(p.artistShare, Math.round(p.profit * it.artistSplit));
    assert.ok(p.artistShare > 0, "the artist earns something on a full-price sale");
  }
  // Items add up to what Stripe charged. Shipping is free; this session has no tax (a real Order.amountTotal includes
  // sales tax, while lineTotal and the artist's share are always before tax).
  assert.equal(db.items.reduce((n, it) => n + it.lineTotal, 0), order.amountTotal);
});

test("the same paid event twice (a Stripe retry) records no second order and no duplicate items", async () => {
  const params = twoLineCheckout();
  const db = fakeDb();
  let listed = 0;
  const listLineItems = async () => { listed++; return asStripeLineItems(params); };
  const session = paidSession(params);

  const first = await recordCheckoutOrder(db, session, { buyerEmail: "ana@example.com", bulk: null, listLineItems });
  const snapshot = structuredClone(db.items);
  // The retry arrives with a different total: totals are never changed after the first time.
  const second = await recordCheckoutOrder(db, { ...session, amount_total: 1 }, { buyerEmail: "ana@example.com", bulk: null, listLineItems });

  assert.equal(second.id, first.id);
  assert.equal(db.orders.length, 1);
  assert.equal(db.orders[0].amountTotal, session.amount_total);
  assert.deepEqual(db.items, snapshot);
  assert.equal(listed, 1, "items are only fetched and created the first time");

  // The webhook relies on the database refusing two orders for one Stripe session.
  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const orderModel = schema.slice(schema.indexOf("model Order {"), schema.indexOf("}", schema.indexOf("model Order {")));
  assert.match(orderModel, /stripeSessionId\s+String\s+@unique/);
});

test("a collector reward comes out of Artfinity's share: the artist is paid as if at full price", async () => {
  const full = priceLine(nightMarket, readCartItem({ product: { slug: "night-market", selectedSize: "medium" } }), noScan);
  const rewarded = { ...full, preRewardUnit: full.unit, unit: full.unit - 500 }; // $5 off (the route caps this at Artfinity's share)
  const params = [stripeLineItem(rewarded, BASE)];
  assert.equal(params[0].price_data.unit_amount, full.unit - 500);
  assert.equal(params[0].price_data.product_data.metadata.rewardFromUnit, String(full.unit));

  const db = fakeDb();
  await recordCheckoutOrder(db, paidSession(params), { buyerEmail: "ana@example.com", bulk: null, listLineItems: async () => asStripeLineItems(params) });
  const [it] = db.items;
  const split = getArtistSplit(ORDER_DATE);
  const atFullPrice = calcItemProfitCents({ lineTotal: full.unit, size: "M", orderDate: ORDER_DATE, artistSplit: split }).artistShare;
  const recorded = calcItemProfitCents({ lineTotal: it.lineTotal, size: "M", orderDate: ORDER_DATE, artistSplit: it.artistSplit }).artistShare;
  assert.ok(it.artistSplit > split);
  assert.ok(Math.abs(recorded - atFullPrice) <= 1, `artist share ${recorded} should match full-price share ${atFullPrice}`);
});

test("an artist's bulk order at cost pays no artist split", async () => {
  const params = twoLineCheckout();
  const db = fakeDb();
  const bulk = { kind: "bulk", bulkArtistId: "artist_free", shippingName: "Maya Chen", shippingAddress: "1 Studio Way, Brooklyn, NY 11201, US" };
  const order = await recordCheckoutOrder(db, paidSession(params), { buyerEmail: "maya@example.com", bulk, listLineItems: async () => asStripeLineItems(params) });
  assert.equal(order.kind, "bulk");
  assert.equal(order.bulkArtistId, "artist_free");
  assert.equal(order.shippingAddress, "1 Studio Way, Brooklyn, NY 11201, US");
  assert.deepEqual(db.items.map((i) => i.artistSplit), [null, null]);
});
