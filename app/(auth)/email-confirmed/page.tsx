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

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Status = "ok" | "expired" | "used" | "invalid";

export default async function EmailConfirmed({ searchParams }: { searchParams: { status?: string } }) {
  const status: Status = (["ok", "expired", "used", "invalid"] as const).find((s) => s === searchParams.status) ?? "invalid";
  const user = await getUserFromCookie().catch(() => null);
  const me = user?.id ? await prisma.artist.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true } }) : null;
  // A used link from someone who's already confirmed is good news, not an error.
  const done = status === "ok" || !!me?.emailVerifiedAt;

  if (done) {
    return (
      <AuthCard className="mx-auto w-full max-w-[520px]">
        <div className="grid gap-5" role="status">
          <h1 className="display text-[clamp(40px,9vw,54px)]">
            Email <Brushed>confirmed</Brushed>
          </h1>
          <p className="text-[16px] text-ink-2">
            {status === "ok" ? "Thanks." : "You'd already confirmed it, so you're all set."} Payouts and newsletters are unlocked. Next, tell us where to send your money.
          </p>
          {me ? (
            <>
              <Link href="/studio/money" className="btn btn-blue btn-lg w-full">Set up payouts</Link>
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
    expired: { title: "That link expired", body: `Confirmation links work for ${VERIFY_DAYS} days. Send yourself a fresh one; it takes a second.` },
    used: { title: "That link was already used", body: "Each link works once, and sending a new one replaces the old one. If you've just confirmed in another tab, you're done. Otherwise, send a fresh link." },
    invalid: { title: "That link didn't work", body: "It may have been cut off when you copied it. Open it straight from the email, or send yourself a fresh one." },
  }[status as Exclude<Status, "ok">];

  return (
    <AuthCard className="mx-auto w-full max-w-[520px]">
      <div className="grid gap-5">
        <h1 className="display text-[clamp(40px,9vw,54px)]">{copy.title}</h1>
        <p className="text-[16px] text-ink-2">{copy.body}</p>
        {me ? (
          <>
            <ResendConfirmButton email={me.email} label="Send a new link" className="btn-blue btn-lg w-full" />
            <p className="text-center text-[14px] text-ink-2">
              It goes to <b className="text-ink">{me.email}</b>.{" "}
              <Link href="/studio/page#account-details" className="font-semibold underline underline-offset-4">Wrong address?</Link>
            </p>
            <Link href="/studio" className="btn btn-ghost btn-lg w-full">Go to my Studio</Link>
          </>
        ) : (
          <>
            <Link href={`/login?next=${encodeURIComponent("/studio#confirm-email")}`} className="btn btn-blue btn-lg w-full">Log in to get a new link</Link>
            <p className="text-center text-[14px] text-ink-2">
              Once you&apos;re in, press <b className="text-ink">Resend</b> at the top of your Studio. Trouble?{" "}
              <Link href="/contact" className="font-semibold underline underline-offset-4">Contact us</Link>
            </p>
          </>
        )}
      </div>
    </AuthCard>
  );
}
