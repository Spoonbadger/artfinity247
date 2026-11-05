// Email confirmation (server only).
// New password sign-ups and email changes get a link /api/auth/verify-email?t=<token>, good for 7 days.
// The token is "<expiry in seconds>.<random>"; only its SHA-256 is stored (Artist.emailVerifyToken), so a database
// read can't be turned into working links. Confirming sets Artist.emailVerifiedAt and clears the token.
// Until confirmed: Studio shows a banner, and payouts (Stripe onboarding, Venmo) and newsletter sending are blocked.
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resend, emailEnabled } from "@/lib/resend";
import ConfirmEmail from "@/emails/ConfirmEmail";

export const VERIFY_DAYS = 7;
/** The one short line shown wherever something waits on a confirmed email. */
export const UNVERIFIED_MESSAGE = "Confirm your email first. We only pay out and send newsletters from confirmed accounts.";

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** A fresh token: store `stored` on the artist, email `raw`. */
export function newVerifyToken(now = Date.now()) {
  const exp = Math.floor(now / 1000) + VERIFY_DAYS * 86400;
  const raw = `${exp}.${randomBytes(24).toString("base64url")}`;
  return { raw, stored: hashToken(raw) };
}

/** Confirms the email behind a link. Returns the artist id, or null if the link is unknown or expired. */
export async function consumeVerifyToken(raw: string): Promise<string | null> {
  const m = /^(\d{9,11})\.[\w-]{20,64}$/.exec(raw || "");
  if (!m) return null;
  const a = await prisma.artist.findUnique({ where: { emailVerifyToken: hashToken(raw) }, select: { id: true } });
  if (!a) return null;
  if (Number(m[1]) * 1000 < Date.now()) {
    await prisma.artist.update({ where: { id: a.id }, data: { emailVerifyToken: null } });
    return null;
  }
  // Conditional on the token so a second click (or a race) is a no-op.
  const r = await prisma.artist.updateMany({ where: { id: a.id, emailVerifyToken: hashToken(raw) }, data: { emailVerifiedAt: new Date(), emailVerifyToken: null } });
  return r.count === 1 ? a.id : null;
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Makes a new link for the artist's current email and sends it. Never throws (sign-up mustn't fail on email). */
export async function sendVerifyEmail(artistId: string): Promise<boolean> {
  try {
    const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true, first_name: true, emailVerifiedAt: true } });
    if (!a || a.emailVerifiedAt) return false;
    const { raw, stored } = newVerifyToken();
    await prisma.artist.update({ where: { id: artistId }, data: { emailVerifyToken: stored } });
    const link = `${appUrl()}/api/auth/verify-email?t=${encodeURIComponent(raw)}`;
    if (!emailEnabled) console.log(`[email:dev] confirm-email link for ${a.email}: ${link}`);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Artfinity <no-reply@theartfinity.com>",
      to: a.email,
      subject: "Confirm your email for Artfinity",
      react: ConfirmEmail({ link, firstName: a.first_name }),
    });
    return true;
  } catch (e) {
    console.error("VERIFY_EMAIL_SEND_FAIL", e);
    return false;
  }
}

/** True when the artist has confirmed their email. */
export async function isEmailVerified(artistId: string): Promise<boolean> {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { emailVerifiedAt: true } });
  return !!a?.emailVerifiedAt;
}
