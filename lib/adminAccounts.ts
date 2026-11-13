// Admin account management helpers (/admin/artists). Server only.
// Password links reuse the forgot-password flow: a PasswordResetToken (SHA-256 stored) and /reset-password?token=...,
// which also confirms the email and bumps sessionVersion when used (app/api/auth/reset-password).
import crypto from "crypto";
import { citySlugFor, stateAbbr } from "@/lib/citySlug";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resend, emailEnabled } from "@/lib/resend";
import { emailHtml } from "@/lib/artistEmails";
import { checkHandle, normalizeHandle } from "@/app/api/auth/_lib/handle";
import PasswordResetEmail from "@/emails/PasswordResetEmail";

const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const FROM = () => process.env.RESEND_FROM_EMAIL || "Artfinity <no-reply@theartfinity.com>";
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AccountError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** A one-time password link (reset or first "set your password"). Returns the link. */
async function passwordLink(artistId: string, hours: number) {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.passwordResetToken.deleteMany({ where: { artistId, expiresAt: { lt: new Date() } } });
  await prisma.passwordResetToken.create({ data: { artistId, tokenHash, expiresAt: new Date(Date.now() + hours * 3_600_000) } });
  return `${APP_URL()}/reset-password?token=${raw}`;
}

/** Same email and 30-minute link as "Forgot password". */
export async function sendPasswordReset(artistId: string) {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true } });
  if (!a) throw new AccountError("Account not found.", 404);
  const resetLink = await passwordLink(artistId, 0.5);
  if (!emailEnabled) console.log(`[email:dev] password reset link for ${a.email}: ${resetLink}`);
  const { error } = await resend.emails.send({ from: FROM(), to: a.email, subject: "Reset your Artfinity password", react: PasswordResetEmail({ resetLink }) });
  if (error) throw new AccountError("The email didn't send. Try again.", 502);
  return a.email;
}

/** For accounts an admin made: "set your password" with a 7-day link. */
export async function sendSetPasswordInvite(artistId: string, inviterName: string) {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { email: true, first_name: true, artist_name: true, name: true, slug: true } });
  if (!a) throw new AccountError("Account not found.", 404);
  const link = await passwordLink(artistId, 7 * 24);
  if (!emailEnabled) console.log(`[email:dev] set-password link for ${a.email}: ${link}`);
  const first = a.first_name || (a.artist_name || a.name).split(" ")[0];
  const text =
    `Hi ${first},\n\n${inviterName} from Artfinity set up your artist page: ${APP_URL()}/@${a.slug}\n\n` +
    `Choose a password to log in, upload your art and get paid when it sells (the link works for 7 days):\n${link}\n\n` +
    `If the link has expired, use "Forgot password" on the login page with this email address.\n\nArtfinity`;
  const { error } = await resend.emails.send({ from: FROM(), to: a.email, subject: "Your Artfinity artist page is ready: set your password", text, html: emailHtml(text) });
  if (error) throw new AccountError("The account was made, but the email didn't send. Use “Send password reset link”.", 502);
  return a.email;
}

/** Email in use by another account? */
export async function emailTaken(email: string, exceptId?: string) {
  return !!(await prisma.artist.findFirst({ where: { email: { equals: email, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } }));
}

export async function validHandle(raw: unknown): Promise<string> {
  const handle = normalizeHandle(String(raw ?? ""));
  const r = await checkHandle(handle);
  if (!r.available) {
    const why = r.reason === "taken" ? "is taken" : r.reason === "reserved" ? "is reserved" : r.reason === "offensive" ? "isn't allowed (slurs and profanity)" : "isn't valid (3–30 letters, numbers, dots or underscores)";
    throw new AccountError(`@${handle} ${why}.${r.suggestions?.length ? ` Try @${r.suggestions[0]}.` : ""}`, r.reason === "taken" ? 409 : 400);
  }
  return handle;
}

export function cleanName(raw: unknown, what = "Name"): string {
  const v = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!v) throw new AccountError(`${what} is required.`);
  if (v.length > 60) throw new AccountError(`${what} is too long (60 characters at most).`);
  return v;
}

/** A US state code or name → its 2-letter code; empty → null. */
export function cleanState(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const code = stateAbbr(v);
  if (!code) throw new AccountError("Use a US state, like NY or TX.");
  return code;
}

export function cleanCity(raw: unknown, state?: string | null): { city: string; citySlug: string } {
  const city = String(raw ?? "").trim();
  if (!city || city.length > 80) throw new AccountError("Add a city (80 characters at most).");
  return { city, citySlug: citySlugFor(city, state) };
}

/** Create an artist account by hand (met at a market). No password: they get a "set your password" email. */
export async function createAccountByAdmin(input: Record<string, unknown>) {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new AccountError("Enter a real email address.");
  if (await emailTaken(email)) throw new AccountError("An account with that email already exists.", 409);
  const artist_name = cleanName(input.artist_name, "Artist name");
  const slug = await validHandle(input.handle);
  const state = cleanState(input.state);
  const { city, citySlug } = cleanCity(input.city, state);
  const first_name = typeof input.first_name === "string" && input.first_name.trim() ? input.first_name.trim().slice(0, 60) : null;
  try {
    return await prisma.artist.create({
      data: { name: artist_name, artist_name, first_name, email, password: null, phone: "", city, citySlug, state, slug, role: "USER" },
      select: { id: true, email: true, slug: true, artist_name: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AccountError("That email or handle was just taken.", 409);
    throw e;
  }
}

/** Why this account can't be deleted, or null when it can (no orders, no payouts, not an admin). */
export async function deleteBlocker(artistId: string): Promise<string | null> {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { role: true } });
  if (!a) return "Account not found.";
  if (a.role === "ADMIN") return "This account is on the admin team. Remove it from the team first.";
  const [orders, payouts] = await Promise.all([
    prisma.orderItem.count({ where: { artwork: { artistId } } }),
    prisma.payout.count({ where: { artistId } }),
  ]);
  const why = [orders ? `${orders} order line${orders === 1 ? "" : "s"}` : "", payouts ? `${payouts} payout${payouts === 1 ? "" : "s"}` : ""].filter(Boolean);
  return why.length ? `It has ${why.join(" and ")}, which must stay on record. Close the account instead.` : null;
}

/** Permanent delete for accounts with no orders or payouts. Art, links, codes and the rest go with it. */
export async function deleteAccountPermanently(artistId: string) {
  const blocker = await deleteBlocker(artistId);
  if (blocker) throw new AccountError(blocker, 409);
  return prisma.$transaction(async (tx) => {
    const a = await tx.artist.findUniqueOrThrow({ where: { id: artistId }, select: { id: true, email: true, slug: true, artist_name: true, name: true, createdAt: true } });
    await tx.artwork.deleteMany({ where: { artistId } });
    await tx.artist.delete({ where: { id: artistId } });
    return a;
  });
}
