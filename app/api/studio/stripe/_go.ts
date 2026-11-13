// Shared by the /api/studio/stripe/* routes: who's asking, and where to send them.
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ConnectError } from "@/lib/stripeConnect";
import { isEmailVerified } from "@/lib/emailVerify";

/**
 * Runs `next` for the signed-in artist and redirects (303) to the URL it returns. Errors go back to Money.
 * `verified`: only for artists who confirmed their email (Stripe onboarding sets where payouts go).
 */
export async function go(req: NextRequest, next: (artistId: string) => Promise<string>, opts: { verified?: boolean } = {}) {
  const user = await requireUser().catch(() => null);
  if (!user?.id) return NextResponse.redirect(new URL("/login?next=/studio/money", req.url), 303);
  if (opts.verified && !(await isEmailVerified(user.id))) return NextResponse.redirect(new URL("/studio/money?stripe=unverified", req.url), 303);
  try {
    return NextResponse.redirect(new URL(await next(user.id), req.url), 303);
  } catch (err) {
    console.error("[stripe connect]", err);
    const code = err instanceof ConnectError ? "off" : "error";
    return NextResponse.redirect(new URL(`/studio/money?stripe=${code}`, req.url), 303);
  }
}
