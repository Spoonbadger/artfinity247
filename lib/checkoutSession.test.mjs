// node --experimental-strip-types --test lib/checkoutSession.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { codeOf, newOrderId, orderIdFrom, shippingFrom, statementSuffix } from "./checkoutSession.ts";

test("shipping address from a basil-version session (collected_information)", () => {
  const s = shippingFrom({
    collected_information: { shipping_details: { name: "Ana Diaz", address: { line1: "12 Orchard St", line2: "Apt 4B", city: "New York", state: "NY", postal_code: "10002", country: "US" } } },
  });
  assert.deepEqual(s, { name: "Ana Diaz", address: "12 Orchard St, Apt 4B, New York, NY 10002, US" });
});

test("shipping address from an older payload (shipping_details)", () => {
  const s = shippingFrom({ shipping_details: { name: "Bo", address: { line1: "1 Main St", city: "Brooklyn", state: "NY", postal_code: "11201", country: "US" } } });
  assert.deepEqual(s, { name: "Bo", address: "1 Main St, Brooklyn, NY 11201, US" });
});

test("no shipping details", () => {
  assert.deepEqual(shippingFrom({}), { name: null, address: null });
  assert.deepEqual(shippingFrom({ collected_information: null }), { name: null, address: null });
});

test("pre-made order ids round-trip through metadata", () => {
  for (let i = 0; i < 200; i++) {
    const id = newOrderId();
    assert.match(id, /^c[a-z0-9]{24}$/);
    assert.equal(orderIdFrom({ orderId: id }), id);
    assert.equal(codeOf(id), id.slice(-6).toUpperCase());
  }
  assert.equal(orderIdFrom({ orderId: "x'; drop" }), null);
  assert.equal(orderIdFrom(null), null);
  assert.equal(orderIdFrom({}), null);
});

test("statement suffix is short and plain", () => {
  assert.equal(statementSuffix("ab-12*cd"), "AB12CD");
  assert.equal(statementSuffix("***"), "ARTFINITY");
  assert.ok(statementSuffix("a very long suffix text").length <= 10);
});
