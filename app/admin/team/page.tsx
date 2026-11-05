import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import ActionButton from "../_components/ActionButton";
import { listTeam, INVITE_DAYS } from "@/lib/adminTeam";
import { ADMIN_ROLES, ROLE_BLURB, ROLE_LABEL, roleCan } from "@/lib/adminCaps";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team" };

const ROLE_CHIP: Record<string, string> = { owner: "bg-ink text-white", admin: "bg-scan-soft text-scan", support: "bg-sticker text-ink" };
const INV_CHIP: Record<string, string> = { pending: "bg-sticker text-ink", accepted: "bg-earned-soft text-earned", revoked: "bg-wall text-ink-2", expired: "bg-coral/15 text-coral" };
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
function ago(d: Date | null) {
  if (!d) return "No admin actions yet";
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days} day${days === 1 ? "" : "s"} ago` : day(d);
}
const roleOptions = ADMIN_ROLES.map((r) => ({ value: r, label: `${ROLE_LABEL[r]}: ${ROLE_BLURB[r]}` }));

export default async function TeamPage() {
  const me = await adminRoleOrRedirect("/admin/team");
  const { members, invites } = await listTeam();
  const owners = members.filter((m) => m.role === "owner" && !m.blocked).length;
  const isOwner = roleCan(me.adminRole, "team");
  const pending = invites.filter((i) => i.state === "pending");
  const past = invites.filter((i) => i.state !== "pending").slice(0, 15);

  return (
    <div className="grid max-w-[1000px] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="display text-[44px] sm:text-[56px]">Team</h1>
          <p className="text-[14px] text-ink-2">{isOwner ? "Invite people by email and choose what they can do." : "Only an owner can change the team."}</p>
        </div>
        <ActionButton
          url="/api/admin/team" body={{ action: "invite" }} need="team" tone="blue" label="Invite an admin" title="Invite someone to the admin team"
          confirm={<>They get an email with a link that works for {INVITE_DAYS} days. They log in or sign up with that address and confirm it, then accept.</>}
          fields={[
            { name: "email", label: "Email", required: true, placeholder: "name@example.com" },
            { name: "role", label: "Role", type: "select", defaultValue: "support", options: roleOptions },
          ]}
          confirmLabel="Send invite" done="Invite sent"
        />
      </div>

      <section aria-labelledby="roles-h" className="grid gap-2 sm:grid-cols-3">
        <h2 id="roles-h" className="sr-only">Roles</h2>
        {ADMIN_ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-line bg-white p-3">
            <span className={cn("inline-block rounded-full px-2 py-px text-[12px] font-bold", ROLE_CHIP[r])}>{ROLE_LABEL[r]}</span>
            <p className="mt-1 text-[13px] text-ink-2">{ROLE_BLURB[r]}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="members-h" className="af-card grid gap-1 p-2 sm:p-3">
        <h2 id="members-h" className="px-2 pt-1 text-[18px] font-bold">Admins <span className="num text-ink-2">{members.length}</span></h2>
        <ul className="divide-y divide-line">
          {members.map((m) => {
            const lastOwner = m.role === "owner" && owners <= 1;
            const self = m.id === me.id;
            return (
              <li key={m.id} className="grid gap-2 px-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/artists/${m.id}`} className="truncate text-[15.5px] font-semibold text-ink no-underline hover:text-scan">{m.name}</Link>
                    <span className={cn("rounded-full px-2 py-px text-[12px] font-bold", ROLE_CHIP[m.role])}>{ROLE_LABEL[m.role]}</span>
                    {self && <span className="text-[12px] font-semibold text-ink-2">you</span>}
                    {!m.verified && <span className="rounded-full bg-coral/15 px-2 py-px text-[11.5px] font-bold text-coral">email not confirmed</span>}
                    {m.blocked && <span className="rounded-full bg-coral px-2 py-px text-[11.5px] font-bold text-white">suspended or closed</span>}
                  </div>
                  <p className="text-[13px] text-ink-2">
                    {m.email} · last active: <span className="text-ink">{ago(m.lastAction)}</span>{m.actions ? ` · ${m.actions} admin action${m.actions === 1 ? "" : "s"}` : ""}
                    {" · "}<Link href={`/admin/activity?admin=${encodeURIComponent(m.email)}`} className="font-semibold text-scan">activity</Link>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <ActionButton
                    url="/api/admin/team" body={{ action: "change_role", artistId: m.id }} need="team" label="Change role" title={`Change ${m.name}'s role`}
                    disabled={lastOwner}
                    confirm={lastOwner ? "This is the last owner." : <>Now: <b>{ROLE_LABEL[m.role]}</b>. Takes effect on their next click.</>}
                    fields={[{ name: "role", label: "New role", type: "select", defaultValue: m.role, options: roleOptions }]}
                    confirmLabel="Change role" done="Role changed"
                  />
                  <ActionButton
                    url="/api/admin/team" body={{ action: "remove", artistId: m.id }} need="team" tone="danger" label={self ? "Leave team" : "Remove"} title={self ? "Leave the admin team?" : `Remove ${m.name} from the team?`}
                    disabled={lastOwner}
                    confirm={<>Their account goes back to a regular artist account and they&apos;re signed out everywhere. {self ? "You&apos;ll lose admin access right away." : "You can invite them again later."}</>}
                    confirmLabel={self ? "Leave" : "Remove"} done="Removed"
                  />
                  {lastOwner && <span className="self-center text-[12px] text-ink-2">Last owner: make someone else an owner first</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="inv-h" className="af-card grid gap-1 p-2 sm:p-3">
        <h2 id="inv-h" className="px-2 pt-1 text-[18px] font-bold">Invites</h2>
        {pending.length === 0 && past.length === 0 ? (
          <p className="px-2 py-4 text-[14px] text-ink-2">No invites yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {[...pending, ...past].map((i) => (
              <li key={i.id} className="grid gap-2 px-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{i.email}</span>
                    <span className={cn("rounded-full px-2 py-px text-[12px] font-bold", ROLE_CHIP[i.role])}>{ROLE_LABEL[i.role]}</span>
                    <span className={cn("rounded-full px-2 py-px text-[12px] font-bold", INV_CHIP[i.state])}>{i.state}</span>
                  </div>
                  <p className="text-[13px] text-ink-2">Sent {day(i.createdAt)} by {i.invitedBy}{i.state === "pending" ? ` · expires ${day(i.expiresAt)}` : ""}</p>
                </div>
                {(i.state === "pending" || i.state === "expired") && (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <ActionButton url="/api/admin/team" body={{ action: "resend", inviteId: i.id }} need="team" label="Resend" title={`Resend the invite to ${i.email}?`}
                      confirm={`A fresh link goes to ${i.email}, good for ${INVITE_DAYS} days. The old link stops working.`} confirmLabel="Resend" done="Invite resent" />
                    {i.state === "pending" && (
                      <ActionButton url="/api/admin/team" body={{ action: "revoke", inviteId: i.id }} need="team" tone="danger" label="Revoke" title={`Cancel the invite to ${i.email}?`}
                        confirm="The link stops working right away." confirmLabel="Revoke" done="Invite cancelled" />
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
