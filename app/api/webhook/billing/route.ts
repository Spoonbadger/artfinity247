// POST /api/webhook/billing: Stripe Billing events for Infinity subscriptions (lib/billing.ts handles them).
// Its own Stripe webhook endpoint and secret (STRIPE_BILLING_WEBHOOK_SECRET), separate from the orders webhook
// (/api/webhook). Events: checkout.session.completed, customer.subscription.created|updated|deleted,
// invoice.paid, invoice.payment_failed. Setup: BILLING_SETUP.md.
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripeOrNull } from "@/lib/stripeConnect";
import { BILLING_EVENTS, handleBillingEvent, liveDeps } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  const stripe = stripeOrNull();
  if (!sig || !stripe || !secret) return new Response("Webhook error: missing signature or Stripe configuration", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("Billing webhook signature error:", (err as Error).message);
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  if (!(BILLING_EVENTS as readonly string[]).includes(event.type)) return new Response(null, { status: 200 });
  try {
    const res = await handleBillingEvent(event, liveDeps());
    console.info("BILLING_WEBHOOK", event.type, event.id, JSON.stringify(res));
  } catch (err) {
    // 500 makes Stripe retry; every handler is safe to run twice.
    console.error("Billing webhook failed:", event.type, event.id, err);
    return new Response("Billing webhook failed", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
