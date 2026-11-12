// POST /api/admin/artists/:id  Admin actions on one account (verification goes through /api/admin/verification/:id).
// Every action is audit-logged and role-gated (lib/adminCaps.ts). Actions on another admin's account need an owner.
//   { action: "suspend", reason }            page offline and no new checkouts, until unsuspended      (suspend)
//   { action: "unsuspend" }                                                                            (suspend)
//   { action: "close" }                      same as the artist closing it themselves (lib/account.ts)  (suspend)
//   { action: "reopen" }                     undo an account close                                      (suspend)
//   { action: "grant_infinity", months }                                                               (accounts)
//   { action: "revoke_infinity" }            Infinity ends now                                          (accounts)
//   { action: "resend_payout_email", month? } the latest paid month by default                          (view)
//   { action: "send_password_reset" }        the forgot-password email and 30-minute link              (accountSupport)
//   { action: "resend_verification" }        a fresh "Confirm your email" link                         (accountSupport)
//   { action: "sign_out_everywhere" }        bumps sessionVersion                                       (accountSupport)
//   { action: "change_email", email }        unconfirms it, sends a confirmation, signs them out        (accounts)
//   { action: "edit_profile", artist_name?, handle?, city? }  old handles keep redirecting (lib/handleRedirects.ts)  (accounts)
//   { action: "disconnect_oauth", oauthId }  remove one social sign-in                                  (owner)
//   { action: "delete", confirm: "<handle>" } permanent; only with no orders or payouts                  (owner)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { closeArtistAccount, reopenArtistAccount } from "@/lib/account";
import { addMonths, formatPlanDate, isProActive } from "@/lib/plans";
import { extendForProUntil, getBillingState } from "@/lib/billing";
import { hasLiveSubscription } from "@/lib/billingStatus";
import { monthLabel } from "@/lib/balance";
import { resend } from "@/lib/resend";
import { currentAdmin, roleCan, type AdminUser } from "@/lib/adminRoles";
import { cantReason, type Capability } from "@/lib/adminCaps";
import { sendVerifyEmail } from "@/lib/emailVerify";
import { HANDLE_CHANGE_ACTION } from "@/lib/handleRedirects";
import { AccountError, EMAIL_RE, cleanCity, cleanName, deleteAccountPermanently, emailTaken, sendPasswordReset, validHandle } from "@/lib/adminAccounts";
import { PROVIDER_LABEL, isProviderId } from "@/lib/oauth/meta";
import PayoutSentEmail from "@/emails/PayoutSentEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM = "Artfinity <notifications@theartfinity.com>";
const CONTACT = process.env.CONTACT_EMAIL || "contact@theartfinity.com";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const NEED: Record<string, Capability> = {
  suspend: "suspend", unsuspend: "suspend", close: "suspend", reopen: "suspend",
  grant_infinity: "accounts", revoke_infinity: "accounts", change_email: "accounts", edit_profile: "accounts",
  resend_payout_email: "view",
  send_password_reset: "accountSupport", resend_verification: "accountSupport", sign_out_everywhere: "accountSupport",
  disconnect_oauth: "disconnectOAuth", delete: "deleteAccount",
};
/** On another admin's account these need the owner (team) role, so nobody can take over a teammate. */
const ADMIN_TARGET_OWNER_ONLY = new Set(["send_password_reset", "sign_out_everywhere", "change_email", "edit_profile", "disconnect_oauth"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin: AdminUser | null = await currentAdmin().catch(() => null);
  if (!admin) return fail("Forbidden", 403);
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(input.action ?? "");
  const need = NEED[action];
  if (!need) return fail("Unknown action.");
  if (!roleCan(admin.adminRole, need)) return fail(cantReason(need), 403);

  const artist = await prisma.artist.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, first_name: true, artist_name: true, name: true, slug: true, city: true, state: true, role: true, password: true,
      closedAt: true, suspendedAt: true, suspendedReason: true, proUntil: true, emailVerifiedAt: true,
    },
  });
  if (!artist) return fail("Account not found.", 404);
  const self = artist.id === admin.id;
  if (artist.role === "ADMIN" && !self && ADMIN_TARGET_OWNER_ONLY.has(action) && !roleCan(admin.adminRole, "team")) return fail("Only an owner can do this to another admin's account.", 403);
  const name = artist.artist_name || artist.name;
  const first = artist.first_name || name.split(" ")[0];
  const target = { type: "artist" as const, id: artist.id };

  try {
    switch (action) {
      case "suspend": {
        const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
        if (!reason) return fail("Add a reason. The artist sees it in Studio.");
        if (artist.role === "ADMIN") return fail("Admins can't be suspended.");
        if (artist.suspendedAt) return fail("Already suspended.", 409);
        // sessionVersion + 1 signs the artist out everywhere; suspended accounts can't log back in (lib/auth.ts).
        const updated = await prisma.artist.update({ where: { id: artist.id }, data: { suspendedAt: new Date(), suspendedReason: reason, sessionVersion: { increment: 1 } }, select: { suspendedAt: true, suspendedReason: true } });
        await resend.emails.send({
          from: FROM, to: artist.email, subject: "Your Artfinity page is paused",
          text: `Hi ${first},\n\nWe've paused your Artfinity page. Your artist page, artwork pages and printed codes are offline for now, and buyers can't check out.\n\nReason: ${reason}\n\nYour earnings are safe and are still paid out on schedule. If you have questions or think this is a mistake, reply to ${CONTACT}.\n\nArtfinity`,
        }).catch((e) => console.error("Suspend email failed", e));
        await logAdminAction(admin, "artist.suspend", target, `Suspended ${name}: ${reason}`, { reason });
        return NextResponse.json({ ok: true, artist: updated });
      }
      case "unsuspend": {
        if (!artist.suspendedAt) return fail("Not suspended.", 409);
        await prisma.artist.update({ where: { id: artist.id }, data: { suspendedAt: null, suspendedReason: null } });
        await resend.emails.send({
          from: FROM, to: artist.email, subject: "Your Artfinity page is back",
          text: `Hi ${first},\n\nYour Artfinity page is live again. Your art and printed codes work as before.\n\nArtfinity`,
        }).catch((e) => console.error("Unsuspend email failed", e));
        await logAdminAction(admin, "artist.unsuspend", target, `Unsuspended ${name}`, { wasReason: artist.suspendedReason, since: artist.suspendedAt });
        return NextResponse.json({ ok: true });
      }
      case "close": {
        if (artist.closedAt) return fail("Already closed.", 409);
        if (artist.role === "ADMIN") return fail("Remove this account from the admin team before closing it.");
        await closeArtistAccount(artist.id);
        await prisma.artist.update({ where: { id: artist.id }, data: { sessionVersion: { increment: 1 } } });
        const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
        await logAdminAction(admin, "artist.close", target, `Closed ${name}'s account${reason ? `: ${reason}` : ""}`, { reason: reason || undefined });
        return NextResponse.json({ ok: true, message: "Account closed. Unpaid earnings are still paid out." });
      }
      case "reopen": {
        if (!artist.closedAt) return fail("This account isn't closed.", 409);
        await reopenArtistAccount(artist.id);
        await logAdminAction(admin, "artist.reopen", target, `Reopened ${name}'s closed account`, { closedAt: artist.closedAt });
        return NextResponse.json({ ok: true });
      }
      case "grant_infinity": {
        const months = Math.round(Number(input.months));
        if (!Number.isFinite(months) || months < 1 || months > 24) return fail("Grant between 1 and 24 months.");
        const now = new Date();
        const from = isProActive(artist, now) ? artist.proUntil! : now;
        const proUntil = addMonths(from, months);
        await prisma.artist.update({ where: { id: artist.id }, data: { proUntil } });
        // Granted months stack on a paid subscription: its next charge moves past them (lib/billing.ts).
        const { pushedTo } = await extendForProUntil(artist.id);
        await logAdminAction(admin, "artist.grant_infinity", target, `Granted ${months} month${months === 1 ? "" : "s"} of Infinity (until ${formatPlanDate(proUntil)})`, { months, from: artist.proUntil, to: proUntil, nextChargeMovedTo: pushedTo });
        return NextResponse.json({ ok: true, proUntil, message: `Infinity until ${formatPlanDate(proUntil)}${pushedTo ? `. Next charge moved to ${formatPlanDate(pushedTo)}` : ""}` });
      }
      case "revoke_infinity": {
        if (!isProActive(artist)) return fail("They don't have Infinity right now.", 409);
        // A paying subscriber would be charged with no Infinity: cancel the subscription first (money role).
        if (hasLiveSubscription(await getBillingState(artist.id))) return fail("They have a paid Infinity subscription. Cancel it under Billing first.", 409);
        await prisma.artist.update({ where: { id: artist.id }, data: { proUntil: new Date() } });
        await logAdminAction(admin, "artist.revoke_infinity", target, `Ended Infinity (was until ${formatPlanDate(artist.proUntil!)})`, { was: artist.proUntil });
        return NextResponse.json({ ok: true, message: "Infinity ended" });
      }
      case "resend_payout_email": {
        const month = typeof input.month === "string" && /^\d{4}-\d{2}$/.test(input.month) ? input.month : null;
        const p = await prisma.payout.findFirst({
          where: { artistId: artist.id, paidAt: { not: null }, ...(month ? { month } : {}) },
          orderBy: { month: "desc" },
          select: { id: true, month: true, amountCents: true, method: true },
        });
        if (!p) return fail("No paid payout to send an email about.", 404);
        const { error } = await resend.emails.send({
          from: FROM, to: artist.email, subject: `Your Artfinity payout for ${monthLabel(p.month)} has been sent`,
          react: PayoutSentEmail({ artistName: name, month: monthLabel(p.month), amountCents: p.amountCents, via: p.method === "stripe" ? "stripe" : undefined }),
        });
        if (error) return fail("The email didn't send. Try again.", 502);
        await logAdminAction(admin, "payout.resend_email", { type: "payout", id: p.id }, `Resent the ${monthLabel(p.month)} payout email`, { artistId: artist.id, month: p.month, amountCents: p.amountCents });
        return NextResponse.json({ ok: true, month: p.month });
      }
      case "send_password_reset": {
        const to = await sendPasswordReset(artist.id);
        await logAdminAction(admin, "artist.password_reset_link", target, `Sent a password reset link to ${to}`, { hadPassword: !!artist.password });
        return NextResponse.json({ ok: true, message: `Reset link sent to ${to}` });
      }
      case "resend_verification": {
        if (artist.emailVerifiedAt) return fail("Their email is already confirmed.", 409);
        if (!(await sendVerifyEmail(artist.id))) return fail("The email didn't send. Try again.", 502);
        await logAdminAction(admin, "artist.resend_verification", target, `Resent the email confirmation link to ${artist.email}`);
        return NextResponse.json({ ok: true, message: `Confirmation link sent to ${artist.email}` });
      }
      case "sign_out_everywhere": {
        await prisma.artist.update({ where: { id: artist.id }, data: { sessionVersion: { increment: 1 } } });
        await logAdminAction(admin, "artist.sign_out_everywhere", target, `Signed ${name} out everywhere`);
        return NextResponse.json({ ok: true, message: self ? "Signed out everywhere, including here." : "Signed out on every device" });
      }
      case "change_email": {
        const email = String(input.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 254) return fail("Enter a real email address.");
        if (email === artist.email.toLowerCase()) return fail("That's already their email.", 409);
        if (await emailTaken(email, artist.id)) return fail("Another account uses that email.", 409);
        // New address: unconfirmed until they click the link; old sessions end (they carry the old email).
        await prisma.artist.update({ where: { id: artist.id }, data: { email, emailVerifiedAt: null, emailVerifyToken: null, sessionVersion: { increment: 1 } } });
        const sent = await sendVerifyEmail(artist.id);
        await logAdminAction(admin, "artist.change_email", target, `Changed email from ${artist.email} to ${email}`, { from: artist.email, to: email, confirmationSent: sent });
        return NextResponse.json({ ok: true, message: sent ? `Email changed. Confirmation sent to ${email}.` : "Email changed, but the confirmation didn't send. Use “Resend confirmation”." });
      }
      case "edit_profile": {
        const data: { artist_name?: string; name?: string; slug?: string; city?: string; citySlug?: string } = {};
        const changes: Record<string, { from: string; to: string }> = {};
        if (typeof input.artist_name === "string" && input.artist_name.trim() !== name) {
          const v = cleanName(input.artist_name, "Display name");
          data.artist_name = v;
          data.name = v;
          changes.artist_name = { from: name, to: v };
        }
        if (typeof input.handle === "string" && input.handle.trim().replace(/^@/, "").toLowerCase() !== artist.slug.toLowerCase()) {
          const slug = await validHandle(input.handle);
          data.slug = slug;
          changes.handle = { from: artist.slug, to: slug };
        }
        if (typeof input.city === "string" && input.city.trim() !== artist.city) {
          const c = cleanCity(input.city, artist.state);
          Object.assign(data, c);
          changes.city = { from: artist.city, to: c.city };
        }
        if (!Object.keys(data).length) return fail("Nothing changed.");
        try {
          await prisma.artist.update({ where: { id: artist.id }, data });
        } catch {
          return fail("That handle was just taken.", 409);
        }
        const summary = Object.entries(changes).map(([k, v]) => `${k === "artist_name" ? "name" : k} ${k === "handle" ? "@" : ""}${v.from} → ${k === "handle" ? "@" : ""}${v.to}`).join(", ");
        await logAdminAction(admin, "artist.edit_profile", target, `Edited profile: ${summary}`, { changes });
        // A separate row per handle change: /@old keeps redirecting to the new handle (lib/handleRedirects.ts).
        if (changes.handle) await logAdminAction(admin, HANDLE_CHANGE_ACTION, target, `Handle @${changes.handle.from} → @${changes.handle.to}`, { from: changes.handle.from, to: changes.handle.to });
        return NextResponse.json({ ok: true, message: "Profile saved" });
      }
      case "disconnect_oauth": {
        const oauthId = String(input.oauthId ?? "");
        const accounts = await prisma.oAuthAccount.findMany({ where: { artistId: artist.id }, select: { id: true, provider: true, email: true } });
        const acc = accounts.find((a) => a.id === oauthId);
        if (!acc) return fail("That sign-in method isn't on this account.", 404);
        if (!artist.password && accounts.length === 1) return fail("This is their only way to log in. Send a password reset link first so they can set a password.", 409);
        await prisma.oAuthAccount.delete({ where: { id: acc.id } });
        const label = isProviderId(acc.provider) ? PROVIDER_LABEL[acc.provider] : acc.provider;
        await logAdminAction(admin, "artist.disconnect_oauth", target, `Disconnected ${label} sign-in${acc.email ? ` (${acc.email})` : ""}`, { provider: acc.provider, email: acc.email });
        return NextResponse.json({ ok: true, message: `${label} disconnected` });
      }
      case "delete": {
        if (self) return fail("You can't delete your own account.");
        if (String(input.confirm ?? "").trim().replace(/^@/, "").toLowerCase() !== artist.slug.toLowerCase()) return fail(`Type the handle (${artist.slug}) to confirm.`);
        const gone = await deleteAccountPermanently(artist.id);
        await logAdminAction(admin, "artist.delete", target, `Permanently deleted ${name} (@${gone.slug}, ${gone.email})`, { email: gone.email, slug: gone.slug, createdAt: gone.createdAt });
        return NextResponse.json({ ok: true, deleted: true, message: "Account deleted" });
      }
    }
  } catch (e) {
    if (e instanceof AccountError) return fail(e.message, e.status);
    console.error("ADMIN_ARTIST_ACTION_FAIL", action, e);
    return fail("Something went wrong.", 500);
  }
  return fail("Unknown action.");
}
