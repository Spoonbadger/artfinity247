// POST /api/webhook/connect  Stripe Connect events (artists' Express accounts), separate from the checkout webhook.
// In Stripe: Developers → Webhooks → Add endpoint, "Events on Connected accounts", event account.updated,
// URL https://<site>/api/webhook/connect. Its signing secret goes in STRIPE_CONNECT_WEBHOOK_SECRET.
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripeOrNull, syncAccount } from "@/lib/stripeConnect";
import { reportError } from "@/lib/monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  const stripe = stripeOrNull();
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!sig || !stripe || !secret) return new Response("Webhook error: missing signature or Stripe configuration", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("Connect webhook signature failed:", err);
    await reportError(err, { area: "webhook", name: "stripe-connect-signature", level: "warning" });
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const ready = await syncAccount(event.data.object as Stripe.Account);
      console.log("[connect] account.updated", event.data.object.id, ready ? "ready" : "not ready");
    } else if (event.type === "account.application.deauthorized" && event.account) {
      // The artist disconnected Artfinity in Stripe: payouts are held until they connect again.
      await prisma.artist.updateMany({ where: { stripeAccountId: event.account }, data: { stripePayoutsEnabled: false } });
    }
  } catch (err) {
    console.error("Connect webhook failed:", err);
    await reportError(err, { area: "webhook", name: "stripe-connect", extra: { eventId: event.id, type: event.type }, adminAlert: true });
    return new Response("Webhook handler failed", { status: 500 });
  }
  return new Response(null, { status: 200 });
}
