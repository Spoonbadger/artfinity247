// Retired. This old all-in-one profile route set the email and Venmo handle directly, skipping email
// confirmation and the emailed Venmo confirmation, and nothing in the app calls it any more. Use instead:
//   /api/studio/account (legal name, email, phone, state)   /api/studio/venmo (payouts)
//   /api/artists/update-artist-name, update-city, update-bio, update-profile-image
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function POST() {
  return NextResponse.json({ error: "This endpoint was retired. Update your details in Studio → My page." }, { status: 410 });
}
