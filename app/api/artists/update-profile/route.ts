// Retired. This old all-in-one profile route set the email and payout details directly, skipping email
// confirmation, and nothing in the app calls it any more. Use instead:
//   /api/studio/account (legal name, email, phone, state)   /api/studio/stripe/connect (payouts, Stripe Connect)
//   /api/artists/update-artist-name, update-city, update-bio, update-profile-image
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function POST() {
  return NextResponse.json({ error: "This endpoint was retired. Update your details in Studio → My page." }, { status: 410 });
}
