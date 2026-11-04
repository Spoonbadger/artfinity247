// Test checkout (no Stripe keys) records "paid" orders without taking money. That's what we want
// on localhost, and a disaster on a production deploy that lost its keys, so it's off in
// production unless ALLOW_TEST_CHECKOUT=1 is set on purpose (e.g. a staging site).
export function testCheckoutAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_CHECKOUT === "1";
}

export function checkoutUnavailable(where: string) {
  console.error(`🚨 [${where}] STRIPE_SECRET_KEY is missing in production and ALLOW_TEST_CHECKOUT is not "1". Refusing to record unpaid orders. Set the Stripe keys.`);
  return new Response(JSON.stringify({ error: "Checkout is temporarily unavailable." }), { status: 503, headers: { "Content-Type": "application/json" } });
}
