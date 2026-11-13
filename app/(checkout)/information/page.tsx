import { redirect } from "next/navigation";

// Shipping details are collected by Stripe Checkout; this step lives on /checkout now.
export default function InformationPage() {
  redirect("/checkout");
}
