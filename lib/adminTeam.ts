// The admin team: invites, role changes and removals. Server only.
// Invites: a 7-day link to /admin/invite/<token>. Only the token's SHA-256 is stored (AdminInvite.token), so a database
// read can't be turned into a working link; "resend" makes a fresh link. Accepting needs the signed-in account's
// confirmed email (emailVerifiedAt) to match the invite.
// The last owner can never be demoted or removed: changes run under a Postgres advisory lock so two owners can't
// demote each other at the same moment.
import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { emailHtml } from "@/lib/artistEmails";
import { ROLE_BLURB, ROLE_LABEL, asAdminRole, isAdminRole, type AdminRole } from "@/lib/adminCaps";

export const INVITE_DAYS = 7;
const FROM = "Artfinity <notifications@theartfinity.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class TeamError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");
export const inviteUrl = (raw: string) => `${APP_URL()}/admin/invite/${raw}`;

export type InviteState = "pending" | "accepted" | "revoked" | "expired";
export function inviteState(i: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()): InviteState {
  if (i.acceptedAt) return "accepted";
  if (i.revokedAt) return "revoked";
  if (i.expiresAt <= now) return "expired";
  return "pending";
}

async function lockTeam(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-team'))`;
}

async function sendInvite(email: string, role: AdminRole, raw: string, inviterName: string, expiresAt: Date) {
  const link = inviteUrl(raw);
  const text =
    `Hi,\n\n${inviterName} invited you to help run Artfinity as ${ROLE_LABEL[role]}: ${ROLE_BLURB[role]}\n\n` +
    `Accept the invite here (good for ${INVITE_DAYS} days, until ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" })}):\n${link}\n\n` +
    `Log in, or sign up, with this email address (${email}) and confirm it. The invite only works for this address.\n\nArtfinity`;
  const { error } = await resend.emails.send({ from: FROM, to: email, subject: `You're invited to the Artfinity admin team`, text, html: emailHtml(text, "Artfinity admin team") });
  if (error) throw new TeamError("The invite email didn't send. Try Resend.", 502);
}

/** New invite (an earlier pending one for the same email is revoked). Returns the invite and its link. */
export async function createInvite(emailRaw: string, roleRaw: unknown, by: { id: string; email?: string | null }) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new TeamError("Enter a real email address.");
  if (!isAdminRole(roleRaw)) throw new TeamError("Pick a role: owner, admin or support.");
  const existing = await prisma.artist.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { role: true } });
  if (existing?.role === "ADMIN") throw new TeamError("That account is already on the admin team. Change its role instead.", 409);
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const now = new Date();
  const invite = await prisma.$transaction(async (tx) => {
    await tx.adminInvite.updateMany({ where: { email, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
    return tx.adminInvite.create({ data: { email, role: roleRaw, token: hashToken(raw), invitedBy: by.id, expiresAt } });
  });
  await sendInvite(email, roleRaw, raw, await inviterName(by.id), expiresAt);
  return { invite, link: inviteUrl(raw) };
}

/** A fresh link and 7 more days for a pending (or expired) invite. */
export async function resendInvite(id: string, by: { id: string }) {
  const inv = await prisma.adminInvite.findUnique({ where: { id } });
  if (!inv) throw new TeamError("Invite not found.", 404);
  const st = inviteState(inv);
  if (st === "accepted" || st === "revoked") throw new TeamError(`This invite was ${st}.`, 409);
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const invite = await prisma.adminInvite.update({ where: { id }, data: { token: hashToken(raw), expiresAt } });
  await sendInvite(inv.email, asAdminRole(inv.role), raw, await inviterName(by.id), expiresAt);
  return { invite, link: inviteUrl(raw) };
}

export async function revokeInvite(id: string) {
  const { count } = await prisma.adminInvite.updateMany({ where: { id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!count) throw new TeamError("That invite is no longer pending.", 409);
  return prisma.adminInvite.findUniqueOrThrow({ where: { id } });
}

async function inviterName(id: string) {
  const a = await prisma.artist.findUnique({ where: { id }, select: { first_name: true, artist_name: true, name: true } });
  return a ? a.first_name || a.artist_name || a.name : "The Artfinity team";
}

export async function inviteByToken(raw: string) {
  if (!raw || raw.length < 20 || raw.length > 100) return null;
  return prisma.adminInvite.findUnique({ where: { token: hashToken(raw) } });
}

export type AcceptCheck =
  | { ok: true; invite: NonNullable<Awaited<ReturnType<typeof inviteByToken>>> }
  | { ok: false; code: "invalid" | "accepted" | "revoked" | "expired" | "wrong_account" | "unverified" | "blocked" | "already_admin"; message: string };

/** Can this signed-in account accept the invite behind `raw`? Shared by the invite page and the accept route. */
export async function checkInvite(raw: string, userId: string | null): Promise<AcceptCheck & { email?: string; role?: AdminRole }> {
  const invite = await inviteByToken(raw);
  if (!invite) return { ok: false, code: "invalid", message: "This invite link isn't valid. Ask for a new one." };
  const base = { email: invite.email, role: asAdminRole(invite.role) };
  const st = inviteState(invite);
  if (st === "accepted") return { ...base, ok: false, code: "accepted", message: "This invite was already accepted." };
  if (st === "revoked") return { ...base, ok: false, code: "revoked", message: "This invite was cancelled. Ask for a new one." };
  if (st === "expired") return { ...base, ok: false, code: "expired", message: "This invite has expired. Ask for a new one." };
  if (!userId) return { ...base, ok: true, invite };
  const a = await prisma.artist.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, role: true, closedAt: true, suspendedAt: true } });
  if (!a) return { ...base, ok: false, code: "wrong_account", message: "Log in first." };
  if (a.email.toLowerCase() !== invite.email.toLowerCase()) return { ...base, ok: false, code: "wrong_account", message: `This invite is for ${invite.email}, but you're logged in as ${a.email}.` };
  if (!a.emailVerifiedAt) return { ...base, ok: false, code: "unverified", message: `Confirm your email (${a.email}) first. We sent you a link when you signed up.` };
  if (a.closedAt || a.suspendedAt) return { ...base, ok: false, code: "blocked", message: "This account is closed or paused." };
  if (a.role === "ADMIN") return { ...base, ok: false, code: "already_admin", message: "You're already on the admin team." };
  return { ...base, ok: true, invite };
}

/** Accept: role=ADMIN with the invite's adminRole. Returns the updated account (to re-issue the session). */
export async function acceptInvite(raw: string, userId: string) {
  const c = await checkInvite(raw, userId);
  if (!c.ok) throw new TeamError(c.message, c.code === "invalid" ? 404 : 409);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.adminInvite.updateMany({ where: { id: c.invite.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (count !== 1) throw new TeamError("This invite is no longer valid.", 409);
    return tx.artist.update({
      where: { id: userId },
      data: { role: "ADMIN", adminRole: asAdminRole(c.invite.role) },
      select: { id: true, email: true, slug: true, role: true, sessionVersion: true, adminRole: true },
    });
  });
}

async function teamMember(tx: Prisma.TransactionClient, id: string) {
  const a = await tx.artist.findUnique({ where: { id }, select: { id: true, email: true, role: true, adminRole: true, artist_name: true, name: true } });
  if (!a || a.role !== "ADMIN") throw new TeamError("That account isn't on the admin team.", 404);
  return { ...a, adminRole: asAdminRole(a.adminRole) };
}

const otherOwners = (tx: Prisma.TransactionClient, id: string) =>
  tx.artist.count({ where: { role: "ADMIN", adminRole: "owner", closedAt: null, suspendedAt: null, NOT: { id } } });

/** Change an admin's role. The last owner can't be demoted. */
export async function changeRole(targetId: string, roleRaw: unknown) {
  if (!isAdminRole(roleRaw)) throw new TeamError("Pick a role: owner, admin or support.");
  return prisma.$transaction(async (tx) => {
    await lockTeam(tx);
    const m = await teamMember(tx, targetId);
    if (m.adminRole === roleRaw) throw new TeamError(`Already ${ROLE_LABEL[roleRaw]}.`, 409);
    if (m.adminRole === "owner" && roleRaw !== "owner" && (await otherOwners(tx, m.id)) === 0) {
      throw new TeamError("This is the last owner. Make someone else an owner first.", 409);
    }
    await tx.artist.update({ where: { id: m.id }, data: { adminRole: roleRaw } });
    return { member: m, from: m.adminRole, to: roleRaw };
  });
}

/** Take someone off the team: back to a regular account, signed out everywhere. The last owner can't be removed. */
export async function removeAdmin(targetId: string) {
  return prisma.$transaction(async (tx) => {
    await lockTeam(tx);
    const m = await teamMember(tx, targetId);
    if (m.adminRole === "owner" && (await otherOwners(tx, m.id)) === 0) throw new TeamError("This is the last owner and can't be removed.", 409);
    await tx.artist.update({ where: { id: m.id }, data: { role: "USER", adminRole: null, sessionVersion: { increment: 1 } } });
    return m;
  });
}

/** Team list with each admin's last action (from the audit log). */
export async function listTeam() {
  const [members, invites] = await Promise.all([
    prisma.artist.findMany({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, first_name: true, last_name: true, artist_name: true, name: true, adminRole: true, createdAt: true, emailVerifiedAt: true, suspendedAt: true, closedAt: true },
    }),
    prisma.adminInvite.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const last = members.length
    ? await prisma.adminAction.groupBy({ by: ["adminId"], where: { adminId: { in: members.map((m) => m.id) } }, _max: { createdAt: true }, _count: { _all: true } })
    : [];
  const lastBy = new Map(last.map((l) => [l.adminId, { at: l._max.createdAt, count: l._count._all }]));
  const inviters = await prisma.artist.findMany({ where: { id: { in: Array.from(new Set(invites.map((i) => i.invitedBy))) } }, select: { id: true, email: true } });
  const inviterEmail = new Map(inviters.map((i) => [i.id, i.email]));
  return {
    members: members.map((m) => ({
      id: m.id, email: m.email, name: [m.first_name, m.last_name].filter(Boolean).join(" ") || m.artist_name || m.name,
      role: asAdminRole(m.adminRole), joined: m.createdAt, verified: !!m.emailVerifiedAt, blocked: !!(m.suspendedAt || m.closedAt),
      lastAction: lastBy.get(m.id)?.at ?? null, actions: lastBy.get(m.id)?.count ?? 0,
    })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: asAdminRole(i.role), state: inviteState(i), createdAt: i.createdAt, expiresAt: i.expiresAt, invitedBy: inviterEmail.get(i.invitedBy) ?? "—" })),
  };
}
