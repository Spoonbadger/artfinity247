// node --experimental-strip-types --test lib/prodigi.test.mjs
// Mock tests for the Prodigi provider (lib/prodigi.ts): the order payload, status mapping and idempotency.
// No network: the API client gets a fake fetch.
import test from "node:test";
import assert from "node:assert/strict";
import {
  SKU_MAP_EXAMPLE, buildOrderPayload, callbackOrderId, createOrder, getOrder, mapCarrier, ourOrderIdOf, parseRecipient,
  parseSkuMap, phaseOf, planSync, prodigiBaseUrl, resolveSku, shippingMethod, tokenMatches,
} from "./prodigi.ts";

const SKUS = JSON.stringify({
  S: "SKU-S", M: "SKU-M", L: "SKU-L", XL: "SKU-XL",
  "M:black": { sku: "SKU-FRAME-M", attributes: { color: "black" } },
  "M:natural": { sku: "SKU-FRAME-M", attributes: { color: "TODO-natural" } }, // placeholder attribute: counts as missing
  "L:white": "TODO-framed-11x17", // placeholder SKU: counts as missing
});
const ORDER_ID = "cm3abcdefghijklmnopqrstuv";

const fakeOrder = (over = {}) => ({
  orderId: ORDER_ID,
  number: "QRSTUV12",
  shipName: "Ana Diaz",
  shipAddress: "12 Orchard St, Apt 4B, New York, NY 10002, US",
  reprintOf: null,
  items: [
    { id: "item1", title: "Harbor at Dusk", size: "M", frame: null, quantity: 2, assetUrl: "https://theartfinity.com/api/printer/originals/item1?e=1&t=x" },
    { id: "item2", title: "Rooftops", size: "M", frame: "black", quantity: 1, assetUrl: "https://theartfinity.com/api/printer/originals/item2?e=1&t=x" },
  ],
  ...over,
});
const cfg = (over = {}) => ({ skus: parseSkuMap(SKUS).map, shippingMethod: "Standard", callbackUrl: "https://theartfinity.com/api/webhook/prodigi?token=abc", idempotencyKey: ORDER_ID, ...over });

// ---------- Payload ----------

test("builds the Prodigi order from a fake order", () => {
  const p = buildOrderPayload(fakeOrder(), cfg());
  assert.equal(p.merchantReference, "QRSTUV12");
  assert.equal(p.idempotencyKey, ORDER_ID);
  assert.equal(p.shippingMethod, "Standard");
  assert.equal(p.callbackUrl, "https://theartfinity.com/api/webhook/prodigi?token=abc");
  assert.deepEqual(p.recipient, {
    name: "Ana Diaz",
    address: { line1: "12 Orchard St", line2: "Apt 4B", postalOrZipCode: "10002", countryCode: "US", townOrCity: "New York", stateOrCounty: "NY" },
  });
  assert.equal(p.items.length, 2);
  assert.deepEqual(p.items[0], {
    merchantReference: "item1", sku: "SKU-M", copies: 2, sizing: "fitPrintArea",
    assets: [{ printArea: "default", url: "https://theartfinity.com/api/printer/originals/item1?e=1&t=x" }],
  });
  assert.equal(p.items[1].sku, "SKU-FRAME-M");
  assert.deepEqual(p.items[1].attributes, { color: "black" });
  assert.deepEqual(p.metadata, { artfinityOrderId: ORDER_ID });
  assert.equal("packingSlip" in p, false);
});

test("no callback URL without a token; packing slip only when asked", () => {
  const p = buildOrderPayload(fakeOrder({ reprintOf: "cm3zzzzzzzzzzzzzzzzzzzzzz" }), cfg({ callbackUrl: null, packingSlipUrl: "https://x.test/slip" }));
  assert.equal("callbackUrl" in p, false);
  assert.deepEqual(p.packingSlip, { url: "https://x.test/slip" });
  assert.equal(p.metadata.reprintOf, "cm3zzzzzzzzzzzzzzzzzzzzzz");
});

test("a missing or placeholder SKU fails with the exact key to add", () => {
  assert.throws(() => buildOrderPayload(fakeOrder({ items: [{ ...fakeOrder().items[0], frame: "natural" }] }), cfg()), /No Prodigi SKU for M \(8×12\) with a natural frame\. Add "M:natural" to PRODIGI_SKUS/);
  assert.throws(() => resolveSku(parseSkuMap(SKUS).map, "L", "white"), /Add "L:white"/);
  assert.throws(() => resolveSku({}, "XL", null), /XL \(18×24\) without a frame\. Add "XL"/);
});

test("the documented example is all placeholders, so nothing is guessed", () => {
  const { map, error } = parseSkuMap(JSON.stringify(SKU_MAP_EXAMPLE));
  assert.equal(error, null);
  assert.deepEqual(map, {});
  assert.match(parseSkuMap(undefined).error, /isn't set/);
  assert.match(parseSkuMap("{nope").error, /valid JSON/);
  assert.match(parseSkuMap("[1]").error, /JSON object/);
  // keys are case-insensitive, odd keys ignored
  assert.deepEqual(parseSkuMap('{"xl:Black":"A","huge":"B"}').map, { "XL:black": { sku: "A" } });
});

test("a print with no original file fails", () => {
  assert.throws(() => buildOrderPayload(fakeOrder({ items: [{ ...fakeOrder().items[0], assetUrl: null }] }), cfg()), /"Harbor at Dusk" has no original file/);
});

test("reads the stored one-line address back, and refuses what it can't read", () => {
  assert.deepEqual(parseRecipient("Bo", "1 Main St, Brooklyn, NY 11201, US").address, { line1: "1 Main St", postalOrZipCode: "11201", countryCode: "US", townOrCity: "Brooklyn", stateOrCounty: "NY" });
  assert.equal(parseRecipient("Bo", "1 Main St, Unit 2, Rear, Albany, NY 12207-1234, US").address.line2, "Unit 2, Rear");
  assert.throws(() => parseRecipient("Bo", "Test order, no shipping"), /Can't read the shipping address/);
  assert.throws(() => parseRecipient("Bo", null), /Can't read/);
  assert.throws(() => parseRecipient("Bo", "1 Main St, Brooklyn, NY ABCDE, US"), /Can't read/);
  assert.throws(() => parseRecipient("", "1 Main St, Brooklyn, NY 11201, US"), /no ship-to name/);
});

test("config: sandbox by default, shipping method default Standard", () => {
  assert.equal(prodigiBaseUrl({}), "https://api.sandbox.prodigi.com");
  assert.equal(prodigiBaseUrl({ PRODIGI_ENV: "live" }), "https://api.prodigi.com");
  assert.equal(shippingMethod({}), "Standard");
  assert.equal(shippingMethod({ PRODIGI_SHIPPING_METHOD: "express" }), "Express");
  assert.equal(shippingMethod({ PRODIGI_SHIPPING_METHOD: "teleport" }), "Standard");
});

// ---------- Callback and token ----------

test("callback: only the Prodigi order id is read", () => {
  assert.equal(callbackOrderId({ specversion: "1.0", type: "com.prodigi.order.status.stage.changed#Complete", subject: "ord_123", data: { order: { id: "ord_123" } } }), "ord_123");
  assert.equal(callbackOrderId({ subject: "ord_77" }), "ord_77");
  assert.equal(callbackOrderId({ data: { order: { id: "../etc" } } }), null);
  assert.equal(callbackOrderId(null), null);
});

test("token compare", () => {
  assert.equal(tokenMatches("s3cret", "s3cret"), true);
  assert.equal(tokenMatches("s3cre", "s3cret"), false);
  assert.equal(tokenMatches("", "s3cret"), false);
  assert.equal(tokenMatches("x", ""), false);
  assert.equal(tokenMatches(null, "s3cret"), false);
});

test("our order id from metadata or the idempotency key (including an admin resend)", () => {
  assert.equal(ourOrderIdOf({ id: "ord_1", metadata: { artfinityOrderId: ORDER_ID } }), ORDER_ID);
  assert.equal(ourOrderIdOf({ id: "ord_1", idempotencyKey: `${ORDER_ID}-r1731400000000` }), ORDER_ID);
  assert.equal(ourOrderIdOf({ id: "ord_1", idempotencyKey: "something-else" }), null);
});

// ---------- Stage mapping ----------

const pending = { shippingStatus: "pending", trackingNumber: null, deliveredAt: null, sentToPrinter: true };
const prodigi = (status, shipments = []) => ({ id: "ord_123", lastUpdated: "2026-11-12T10:00:00Z", status: { issues: [], details: {}, ...status }, shipments });
const shipped = (number, carrier = "USPS", dispatchDate = "2026-11-12T09:00:00Z", id = "shp_1") => ({ id, status: "Shipped", dispatchDate, carrier: { name: carrier, service: "Ground" }, tracking: { number, url: `https://track.test/${number}` } });

test("stages map to phases", () => {
  assert.equal(phaseOf(prodigi({ stage: "InProgress", details: { downloadAssets: "InProgress" } })), "received");
  assert.equal(phaseOf(prodigi({ stage: "InProgress", details: { inProduction: "InProgress" } })), "printing");
  assert.equal(phaseOf(prodigi({ stage: "InProgress", details: { inProduction: "Complete", shipping: "InProgress" } })), "shipping");
  assert.equal(phaseOf(prodigi({ stage: "Complete" })), "complete");
  assert.equal(phaseOf(prodigi({ stage: "Cancelled" })), "cancelled");
  assert.equal(phaseOf(prodigi({ stage: "AwaitingPayment" })), "awaiting_payment");
});

test("printing: no status change, just recorded", () => {
  const plan = planSync(pending, prodigi({ stage: "InProgress", details: { inProduction: "InProgress" } }));
  assert.equal(plan.phase, "printing");
  assert.equal(plan.ship, null);
  assert.equal(plan.problem, null);
  assert.equal(plan.markSent, false);
  assert.match(plan.summary, /^Printing/);
});

test("a shipment with tracking ships the order (USPS mapped, link kept)", () => {
  const plan = planSync(pending, prodigi({ stage: "InProgress", details: { shipping: "Complete" } }, [shipped("9400100000000000000000")]));
  assert.deepEqual(plan.ship, { carrier: "USPS", number: "9400100000000000000000", url: "https://track.test/9400100000000000000000" });
  assert.equal(plan.phase, "shipping");
});

test("carriers", () => {
  assert.equal(mapCarrier("USPS"), "USPS");
  assert.equal(mapCarrier("United States Postal Service"), "USPS");
  assert.equal(mapCarrier("UPS"), "UPS");
  assert.equal(mapCarrier("FedEx Ground"), "FedEx");
  assert.equal(mapCarrier("DHL Express"), "Other");
  assert.equal(mapCarrier(null), "Other");
});

test("split parcels: the first dispatched is the order's tracking, the rest are listed", () => {
  const plan = planSync(pending, prodigi({ stage: "Complete" }, [shipped("1Z999BBB", "UPS", "2026-11-13T00:00:00Z", "shp_2"), shipped("1Z999AAA", "UPS", "2026-11-12T00:00:00Z", "shp_1")]));
  assert.equal(plan.ship.number, "1Z999AAA");
  assert.deepEqual(plan.extraTracking.map((t) => t.number), ["1Z999BBB"]);
  assert.equal(plan.phase, "complete");
});

test("complete with no tracking: noted, not marked shipped", () => {
  const plan = planSync(pending, prodigi({ stage: "Complete" }));
  assert.equal(plan.ship, null);
  assert.match(plan.notes.join(" "), /no tracking/);
});

test("cancelled raises an urgent alert and never ships", () => {
  const plan = planSync(pending, prodigi({ stage: "Cancelled" }, [shipped("9400111")]));
  assert.equal(plan.ship, null);
  assert.equal(plan.problem.key, "cancelled");
  assert.equal(plan.problem.severity, "urgent");
  assert.equal(plan.clearProblem, false);
});

test("issues and failed steps raise a problem alert; clearing them resolves it", () => {
  const bad = planSync(pending, prodigi({ stage: "InProgress", issues: [{ errorCode: "items.assets.NotDownloaded", description: "Couldn't download the image" }], details: { downloadAssets: "Error" } }));
  assert.equal(bad.problem.key, "problem");
  assert.match(bad.problem.text, /Couldn't download the image; downloadAssets failed/);
  const ok = planSync(pending, prodigi({ stage: "InProgress", details: { downloadAssets: "Complete" } }));
  assert.equal(ok.problem, null);
  assert.equal(ok.clearProblem, true);
});

test("awaiting payment on our Prodigi account is urgent", () => {
  const plan = planSync(pending, prodigi({ stage: "AwaitingPayment" }));
  assert.equal(plan.problem.severity, "urgent");
  assert.match(plan.problem.text, /payment/);
});

test("manual override wins: hand-entered tracking is kept", () => {
  const plan = planSync({ ...pending, shippingStatus: "shipped", trackingNumber: "MANUAL123" }, prodigi({ stage: "Complete" }, [shipped("9400222")]));
  assert.equal(plan.ship, null);
  assert.match(plan.notes[0], /Kept the tracking entered by hand/);
  // marked shipped by hand with no number: Prodigi's number is saved (markShipped won't email again: not pending)
  const plan2 = planSync({ ...pending, shippingStatus: "shipped" }, prodigi({ stage: "Complete" }, [shipped("9400222")]));
  assert.equal(plan2.ship.number, "9400222");
});

// ---------- Idempotency and order ----------

/** A tiny in-memory order that applies a plan the way lib/prodigiSync.ts does (markShipped claims pending -> shipped). */
function apply(ours, plan, log) {
  const next = { ...ours };
  if (plan.markSent) next.sentToPrinter = true;
  if (plan.ship) {
    if (next.trackingNumber !== plan.ship.number) { next.trackingNumber = plan.ship.number; log.push("tracking"); }
    if (next.shippingStatus === "pending") { next.shippingStatus = "shipped"; log.push("email"); }
  }
  return next;
}

test("the same callback twice: second time changes nothing and emails nobody", () => {
  const p = prodigi({ stage: "InProgress", details: { shipping: "Complete" } }, [shipped("9400333")]);
  const log = [];
  const first = apply(pending, planSync(pending, p), log);
  const plan2 = planSync(first, p);
  const second = apply(first, plan2, log);
  assert.deepEqual(log, ["tracking", "email"]);
  assert.deepEqual(second, first);
  assert.equal(plan2.ship, null);
  assert.equal(plan2.signature, planSync(pending, p).signature, "same Prodigi state, same signature: no second audit row");
});

test("out of order: an older 'printing' read after shipping doesn't move the order back", () => {
  const log = [];
  const shippedOrder = apply(pending, planSync(pending, prodigi({ stage: "Complete" }, [shipped("9400444")])), log);
  const late = planSync(shippedOrder, prodigi({ stage: "InProgress", details: { inProduction: "InProgress" } }));
  const after = apply(shippedOrder, late, log);
  assert.equal(after.shippingStatus, "shipped");
  assert.equal(after.trackingNumber, "9400444");
  assert.deepEqual(log, ["tracking", "email"]);
});

test("delivered orders are never touched", () => {
  const delivered = { shippingStatus: "delivered", trackingNumber: null, deliveredAt: new Date(), sentToPrinter: true };
  assert.equal(planSync(delivered, prodigi({ stage: "Complete" }, [shipped("9400555")])).ship, null);
});

test("signature changes when something worth recording changes", () => {
  const a = planSync(pending, prodigi({ stage: "InProgress", details: { inProduction: "InProgress" } })).signature;
  const b = planSync(pending, prodigi({ stage: "InProgress", details: { inProduction: "Complete" } })).signature;
  const c = planSync(pending, prodigi({ stage: "InProgress", details: { inProduction: "Complete" } }, [shipped("9400666")])).signature;
  assert.notEqual(a, b);
  assert.notEqual(b, c);
});

// ---------- API client (fake fetch) ----------

function fakeFetch(responses) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { f, calls };
}
const ENV = { PRODIGI_API_KEY: "test-key-not-real", PRODIGI_ENV: "sandbox" };

test("createOrder posts to the sandbox with X-API-Key and returns the id", async () => {
  const { f, calls } = fakeFetch([{ body: { outcome: "Created", order: { id: "ord_900", status: { stage: "InProgress" } } } }]);
  const payload = buildOrderPayload(fakeOrder(), cfg());
  const r = await createOrder(payload, ENV, f);
  assert.equal(r.id, "ord_900");
  assert.equal(calls[0].url, "https://api.sandbox.prodigi.com/v4.0/Orders");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-API-Key"], "test-key-not-real");
  assert.equal(JSON.parse(calls[0].init.body).idempotencyKey, ORDER_ID);
});

test("a repeated idempotency key returns the same Prodigi order (retry after a lost save)", async () => {
  const { f } = fakeFetch([
    { body: { outcome: "Created", order: { id: "ord_901" } } },
    { body: { outcome: "AlreadyExists", order: { id: "ord_901" } } },
  ]);
  const payload = buildOrderPayload(fakeOrder(), cfg());
  const a = await createOrder(payload, ENV, f);
  const b = await createOrder(payload, ENV, f);
  assert.equal(a.id, b.id);
  assert.equal(b.outcome, "AlreadyExists");
});

test("API errors become a short reason without the key", async () => {
  const { f } = fakeFetch([{ status: 400, body: { outcome: "ValidationFailed", failures: { "items[0].sku": [{ code: "NotFound" }] } } }]);
  await assert.rejects(createOrder(buildOrderPayload(fakeOrder(), cfg()), ENV, f), (err) => {
    assert.match(err.message, /Prodigi 400: ValidationFailed: items\[0\]\.sku NotFound/);
    assert.equal(err.message.includes("test-key-not-real"), false);
    return true;
  });
  await assert.rejects(createOrder(buildOrderPayload(fakeOrder(), cfg()), {}, f), /PRODIGI_API_KEY isn't set/);
});

test("getOrder fetches by id and checks it's the same order", async () => {
  const { f, calls } = fakeFetch([{ body: { outcome: "Ok", order: { id: "ord_5", status: { stage: "Complete" } } } }, { body: { order: { id: "ord_6" } } }]);
  const o = await getOrder("ord_5", { ...ENV, PRODIGI_ENV: "live" }, f);
  assert.equal(o.status.stage, "Complete");
  assert.equal(calls[0].url, "https://api.prodigi.com/v4.0/Orders/ord_5");
  await assert.rejects(getOrder("ord_5", ENV, f), /different order/);
  await assert.rejects(getOrder("nope", ENV, f), /Not a Prodigi order id/);
});

test("a local mock URL only works outside production", () => {
  assert.equal(prodigiBaseUrl({ PRODIGI_API_URL: "http://localhost:4010" }), "http://localhost:4010");
  assert.equal(prodigiBaseUrl({ PRODIGI_API_URL: "http://localhost:4010", NODE_ENV: "production", PRODIGI_ENV: "live" }), "https://api.prodigi.com");
  assert.equal(prodigiBaseUrl({ PRODIGI_API_URL: "https://evil.test" }), "https://api.sandbox.prodigi.com");
});
