import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout" };

export default function CheckoutPage() {
  // Without Stripe keys (localhost) checkout records a paid test order instead of charging.
  return <CheckoutClient testMode={!process.env.STRIPE_SECRET_KEY} />;
}
