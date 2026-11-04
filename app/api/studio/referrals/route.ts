// GET /api/studio/referrals: the signed-in artist's referral code (created on first use), link and referrals.
import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { REFERRALS } from "@/lib/plans";
import { ensureReferralCode, getReferrals, referralLink } from "@/lib/referrals";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const code = await ensureReferralCode(user.id);
  const referrals = await getReferrals(user.id);
  return NextResponse.json({ code, link: referralLink(code), rule: REFERRALS, referrals });
}
