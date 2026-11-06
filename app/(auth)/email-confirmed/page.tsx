// Where the "Confirm your email" link lands (GET /api/auth/verify-email redirects here with ?status=).
// Every outcome gets a plain answer and the next step: go to the Studio, send a fresh link, or log in first.
import Link from "next/link";
import type { Metadata } from "next";
import { Brushed } from "@/components/af/Brush";
import { AuthCard } from "@/components/auth/ui";
import ResendConfirmButton from "@/components/studio/ResendConfirmButton";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERIFY_DAYS } from "@/lib/emailVerify";
import { PAYOUT_DAY_OF_MONTH } from "@/lib/balance";
import { connectMode, connectStatus } from "@/lib/stripeConnect";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

type Status = "ok" | "expired" | "used" | "invalid";

export default async function EmailConfirmed({ searchParams }: { searchParams: { status?: string } }) {
  const status: Status = (["ok", "expired", "used", "invalid"] as const).find((s) => s === searchParams.status) ?? "invalid";
  const user = await getUserFromCookie().catch(() => null);
  const me = user?.id ? await prisma.artist.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true, stripeAccountId: true, stripePayoutsEnabled: true } }) : null;
  // A used link from someone who's already confirmed is good news, not an error.
  const done = status === "ok" || !!me?.emailVerifiedAt;

  if (done) {
    return (
      <AuthCard className="mx-auto w-full max-w-[520px]">
        <div className="grid gap-5" role="status">
          <h1 className="t-page">
            Email <Brushed>confirmed</Brushed>
          </h1>
          <p className="t-body text-ink-2">
            {status === "ok" ? "Thanks." : "You'd already confirmed it."} Payouts and newsletters are on. Next, tell us where to send your money.
          </p>
          <p className="t-small">Each month&apos;s sales are paid by the {ordinal(PAYOUT_DAY_OF_MONTH)} of the next month, to your bank or Venmo.</p>
          {me ? (
            <>
              {/* Straight into Stripe's payout setup: no stop on Money to press "Connect" again. */}
              {connectMode() !== "off" && connectStatus(me) !== "ready" ? (
                <form method="post" action="/api/studio/stripe/connect" className="grid">
                  <button type="submit" className="btn btn-blue btn-lg w-full">Set up payouts</button>
                </form>
              ) : (
                <Link href="/studio/money" className="btn btn-blue btn-lg w-full">{connectStatus(me) === "ready" ? "See my money" : "Set up payouts"}</Link>
              )}
              <Link href="/studio" className="btn btn-ghost btn-lg w-full">Go to my Studio</Link>
            </>
          ) : (
            <Link href="/login?next=/studio/money" className="btn btn-blue btn-lg w-full">Log in to set up payouts</Link>
          )}
        </div>
      </AuthCard>
    );
  }

  const copy = {
    expired: { title: "That link expired", body: `Links work for ${VERIFY_DAYS} days. Send yourself a fresh one.` },
    used: { title: "That link was already used", body: "Each link works once. If you just confirmed in another tab, you're done. If not, send a fresh one." },
    invalid: { title: "That link didn't work", body: "It may have been cut off. Open it from the email, or send a fresh one." },
  }[status as Exclude<Status, "ok">];

  return (
    <AuthCard className="mx-auto w-full max-w-[520px]">
      <div className="grid gap-5">
        <h1 className="t-page">{copy.title}</h1>
        <p className="t-body text-ink-2">{copy.body}</p>
        {me ? (
          <>
            <ResendConfirmButton email={me.email} label="Send a new link" className="btn-blue btn-lg w-full" />
            <p className="t-small text-center">
              It goes to <b className="text-ink">{me.email}</b>.{" "}
              <Link href="/studio/page#account-details" className="font-semibold underline underline-offset-4">Wrong address?</Link>
            </p>
            <Link href="/studio" className="btn btn-ghost btn-lg w-full">Go to my Studio</Link>
          </>
        ) : (
          <>
            <Link href={`/login?next=${encodeURIComponent("/studio#confirm-email")}`} className="btn btn-blue btn-lg w-full">Log in to get a new link</Link>
            <p className="t-small text-center">
              Then press <b className="text-ink">Resend</b> at the top of your Studio. Stuck?{" "}
              <Link href="/contact" className="font-semibold underline underline-offset-4">Contact us</Link>
            </p>
          </>
        )}
      </div>
    </AuthCard>
  );
}
