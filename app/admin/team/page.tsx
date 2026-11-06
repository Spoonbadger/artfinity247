import type { Metadata } from "next";
import Link from "next/link";
import { adminRoleOrRedirect } from "../_components/gate";
import ActionButton from "../_components/ActionButton";
import { listTeam, INVITE_DAYS } from "@/lib/adminTeam";
import { ADMIN_ROLES, ROLE_BLURB, ROLE_LABEL, roleCan } from "@/lib/adminCaps";
import MoreMenu from "../_components/MoreMenu";
import { PageHead, Pill, StatusPill, type Tone } from "../_components/ui";
import { DataTable, type Row } from "../_components/table";
import { EmptyState } from "@/components/studio/EmptyState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Team" };

const ROLE_TONE: Record<string, Tone> = { owner: "ink", admin: "blue", support: "amber" };
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

  const memberRows: Row[] = members.map((m) => {
    const lastOwner = m.role === "owner" && owners <= 1;
    const self = m.id === me.id;
    return {
      id: m.id,
      search: `${m.name} ${m.email}`,
      sort: { name: m.name.toLowerCase(), role: ADMIN_ROLES.indexOf(m.role), active: m.lastAction ? m.lastAction.toISOString() : null, actions: m.actions },
      cells: {
        name: (
          <div className="min-w-0">
            <span className="flex flex-wrap items-center gap-1.5">
              <Link href={`/admin/artists/${m.id}`} className="truncate font-semibold text-ink no-underline hover:text-scan">{m.name}</Link>
              {self && <span className="text-[13px] font-semibold text-ink-2">you</span>}
              {!m.verified && <Pill tone="amber">Email not confirmed</Pill>}
              {m.blocked && <Pill tone="red">Suspended or closed</Pill>}
            </span>
            <span className="block truncate text-[13px] text-ink-2">{m.email}</span>
          </div>
        ),
        role: <Pill tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Pill>,
        active: <span className="whitespace-nowrap text-[13px]">{ago(m.lastAction)}</span>,
        actions: <Link href={`/admin/activity?admin=${encodeURIComponent(m.email)}`} className="font-semibold text-scan">{m.actions}</Link>,
        do: (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <ActionButton
              url="/api/admin/team" body={{ action: "change_role", artistId: m.id }} need="team" label="Change role" title={`Change ${m.name}'s role`}
              disabled={lastOwner}
              confirm={lastOwner ? "This is the last owner." : <>Now: <b>{ROLE_LABEL[m.role]}</b>. Takes effect on their next click.</>}
              fields={[{ name: "role", label: "New role", type: "select", defaultValue: m.role, options: roleOptions }]}
              confirmLabel="Change role" done="Role changed"
            />
            <MoreMenu label={<><span className="sr-only">More for {m.name}</span><span aria-hidden="true">More</span></>}>
              <ActionButton
                url="/api/admin/team" body={{ action: "remove", artistId: m.id }} need="team" tone="danger" label={self ? "Leave team" : "Remove from team"} title={self ? "Leave the admin team?" : `Remove ${m.name} from the team?`}
                disabled={lastOwner}
                confirm={<>Their account goes back to a regular artist account and they&apos;re signed out everywhere. {self ? "You lose admin access right away." : "You can invite them again later."}</>}
                confirmLabel={self ? "Leave" : "Remove"} done="Removed"
              />
              {lastOwner && <span className="t-small px-2">Last owner: make someone else an owner first.</span>}
            </MoreMenu>
          </div>
        ),
      },
    };
  });
  const inviteRows: Row[] = [...pending, ...past].map((i) => ({
    id: i.id,
    status: i.state,
    search: `${i.email} ${i.invitedBy}`,
    date: i.createdAt.toISOString(),
    sort: { email: i.email, role: ADMIN_ROLES.indexOf(i.role), state: i.state, sent: i.createdAt.toISOString() },
    cells: {
      email: <span className="block max-w-[260px] truncate font-semibold">{i.email}</span>,
      role: <Pill tone={ROLE_TONE[i.role]}>{ROLE_LABEL[i.role]}</Pill>,
      state: <StatusPill status={i.state === "accepted" ? "approved" : i.state === "expired" ? "failed" : i.state === "revoked" ? "closed" : "pending"} label={i.state.charAt(0).toUpperCase() + i.state.slice(1)} />,
      sent: <span className="whitespace-nowrap text-[13px]" title={`By ${i.invitedBy}`}>{day(i.createdAt)}{i.state === "pending" ? <span className="block text-ink-2">expires {day(i.expiresAt)}</span> : null}</span>,
      do: (i.state === "pending" || i.state === "expired") ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          <ActionButton url="/api/admin/team" body={{ action: "resend", inviteId: i.id }} need="team" label="Resend" title={`Resend the invite to ${i.email}?`}
            confirm={`A fresh link goes to ${i.email}, good for ${INVITE_DAYS} days. The old link stops working.`} confirmLabel="Resend" done="Invite resent" />
          {i.state === "pending" && (
            <ActionButton url="/api/admin/team" body={{ action: "revoke", inviteId: i.id }} need="team" tone="danger" label="Revoke" title={`Cancel the invite to ${i.email}?`}
              confirm="The link stops working right away." confirmLabel="Revoke" done="Invite cancelled" />
          )}
        </div>
      ) : null,
    },
  }));

  return (
    <div className="grid max-w-[1000px] gap-5">
      <PageHead
        title="Team"
        sub={isOwner ? `${members.length} ${members.length === 1 ? "admin" : "admins"}${pending.length ? ` · ${pending.length} invite${pending.length === 1 ? "" : "s"} out` : ""}` : "Only an owner can change the team."}
        action={
          <ActionButton
            url="/api/admin/team" body={{ action: "invite" }} need="team" tone="blue" label="Invite an admin" title="Invite someone to the admin team"
            confirm={<>The email link works for {INVITE_DAYS} days. They sign in with that address, confirm it, then accept.</>}
            fields={[
              { name: "email", label: "Email", required: true, placeholder: "name@example.com" },
              { name: "role", label: "Role", type: "select", defaultValue: "support", options: roleOptions },
            ]}
            confirmLabel="Send invite" done="Invite sent"
          />
        }
      />

      <DataTable
        id="team"
        caption="Admins"
        minWidth={640}
        defaultSort={{ key: "role", dir: "asc" }}
        columns={[
          { key: "name", label: "Admin" },
          { key: "role", label: "Role", firstDir: "asc" },
          { key: "active", label: "Last active", firstDir: "desc" },
          { key: "actions", label: "Actions", align: "right" },
          { key: "do", label: <span className="sr-only">Manage</span>, sortable: false, align: "right" },
        ]}
        rows={memberRows}
      />

      <section aria-labelledby="inv-h" className="grid gap-2">
        <h2 id="inv-h" className="t-card">Invites</h2>
        <DataTable
          id="team-invites"
          caption="Invites"
          minWidth={600}
          defaultSort={{ key: "sent", dir: "desc" }}
          statuses={inviteRows.length > 4 ? [{ value: "pending", label: "Pending" }, { value: "accepted", label: "Accepted" }, { value: "expired", label: "Expired" }, { value: "revoked", label: "Revoked" }] : undefined}
          columns={[
            { key: "email", label: "Email" },
            { key: "role", label: "Role", firstDir: "asc" },
            { key: "state", label: "Status" },
            { key: "sent", label: "Sent", firstDir: "desc" },
            { key: "do", label: <span className="sr-only">Manage</span>, sortable: false, align: "right" },
          ]}
          rows={inviteRows}
          empty={<EmptyState dab="var(--af-edge-strong)" compact title="No invites yet" body="Invite someone with the button above." />}
        />
      </section>

      <details className="af-panel p-4">
        <summary className="cursor-pointer text-[15px] font-bold">What each role can do</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {ADMIN_ROLES.map((r) => (
            <div key={r} className="rounded-xl border border-edge bg-white p-3">
              <Pill tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Pill>
              <p className="mt-1 text-[13px] text-ink-2">{ROLE_BLURB[r]}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
