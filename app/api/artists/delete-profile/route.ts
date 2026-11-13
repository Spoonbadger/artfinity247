// DELETE /api/artists/delete-profile : closes the signed-in artist's account.
// The page and art go offline right away. Payouts, orders and sales are kept, so unpaid
// earnings are still paid on the normal schedule. Logs the artist out and emails a confirmation.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { closeArtistAccount } from "@/lib/account";
import { getBalance, PAYOUT_DAY_OF_MONTH } from "@/lib/balance";
import { resend } from "@/lib/resend";
import { emailHtml } from "@/lib/artistEmails";
import { connectStatus } from "@/lib/stripeConnect";

export const dynamic = "force-dynamic";

const usd = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function DELETE() {
  try {
    // A paused (suspended) account can still close itself, and an already-closed one just gets logged out, so this
    // uses getUserFromCookie (valid, unrevoked session) rather than requireUser/activeUserGuard.
    const user = await getUserFromCookie();
    if (!user) return NextResponse.json({ error: "Log in again to close your account.", code: "not_logged_in" }, { status: 401 });
    const artist = await prisma.artist.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, first_name: true, artist_name: true, name: true, closedAt: true, stripeAccountId: true, stripePayoutsEnabled: true },
    });
    if (!artist) return NextResponse.json({ error: "Log in again to close your account.", code: "not_logged_in" }, { status: 401 });

    if (!artist.closedAt) {
      await closeArtistAccount(artist.id);

      try {
        const b = await getBalance(artist.id);
        const owed = b.pendingCents + b.availableCents;
        const first = artist.first_name || (artist.artist_name || artist.name || "there").split(" ")[0];
        const lines = [
          `Hi ${first},`,
          "Your Artfinity account is closed. Your page and your art are offline, and your codes no longer open them.",
          owed > 0
            ? connectStatus(artist) === "ready"
              ? `You still have ${usd(owed)} in earnings that haven't been paid yet. We'll still pay it through Stripe on the normal schedule: each month's sales go out by the ${PAYOUT_DAY_OF_MONTH}th of the next month, after the 14-day return window.`
              : `You still have ${usd(owed)} in earnings that haven't been paid yet. We pay through Stripe, and your Stripe isn't set up yet, so we're holding it for you. Reply to this email and we'll help you connect Stripe so we can send it.`
            : "You have no unpaid earnings with us.",
          "Your past sales stay on record. Changed your mind? Reply to this email and we'll reopen your account.",
          "Thank you for selling with Artfinity.",
        ];
        const body = lines.join("\n\n");
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Artfinity <no-reply@theartfinity.com>",
          to: artist.email,
          subject: "Your Artfinity account is closed",
          html: emailHtml(body, "Artfinity"),
          text: body,
        });
      } catch (err) {
        console.error("Account closed email failed", err);
      }
    }

    // Log out this browser.
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set("auth-token", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err: any) {
    if (err?.status === 401) return NextResponse.json({ error: "Log in again to close your account.", code: "not_logged_in" }, { status: 401 });
    console.error("Close account failed:", err);
    return NextResponse.json({ error: "We couldn't close your account just now. Try again, or message us and we'll do it for you." , code: "server_error" }, { status: 500 });
  }
}
