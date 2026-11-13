// POST /api/admin/team  Owner only. Every change is audit-logged.
//   { action: "invite", email, role }        7-day invite link by email
//   { action: "resend", inviteId }           fresh link, 7 more days
//   { action: "revoke", inviteId }
//   { action: "change_role", artistId, role }
//   { action: "remove", artistId }           back to a regular account, signed out everywhere
// The last owner can't be demoted or removed (lib/adminTeam.ts).
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { ROLE_LABEL } from "@/lib/adminCaps";
import { logAdminAction } from "@/lib/audit";
import { TeamError, changeRole, createInvite, removeAdmin, resendInvite, revokeInvite } from "@/lib/adminTeam";
import { emailEnabled } from "@/lib/resend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("team");
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  try {
    switch (b.action) {
      case "invite": {
        const { invite, link } = await createInvite(str("email"), b.role, admin);
        await logAdminAction(admin, "team.invite", { type: "invite", id: invite.id }, `Invited ${invite.email} as ${ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL] ?? invite.role}`, { email: invite.email, role: invite.role });
        if (!emailEnabled) console.log(`[email:dev] admin invite link for ${invite.email}: ${link}`);
        return NextResponse.json({ ok: true, message: `Invite sent to ${invite.email}` });
      }
      case "resend": {
        const { invite, link } = await resendInvite(str("inviteId"), admin);
        await logAdminAction(admin, "team.invite_resend", { type: "invite", id: invite.id }, `Resent the admin invite to ${invite.email}`, { email: invite.email });
        if (!emailEnabled) console.log(`[email:dev] admin invite link for ${invite.email}: ${link}`);
        return NextResponse.json({ ok: true, message: "Invite resent with a fresh link" });
      }
      case "revoke": {
        const invite = await revokeInvite(str("inviteId"));
        await logAdminAction(admin, "team.invite_revoke", { type: "invite", id: invite.id }, `Cancelled the admin invite to ${invite.email}`, { email: invite.email });
        return NextResponse.json({ ok: true, message: "Invite cancelled" });
      }
      case "change_role": {
        const r = await changeRole(str("artistId"), b.role);
        await logAdminAction(admin, "team.role_change", { type: "artist", id: r.member.id }, `Changed ${r.member.email} from ${ROLE_LABEL[r.from]} to ${ROLE_LABEL[r.to]}`, { from: r.from, to: r.to });
        return NextResponse.json({ ok: true, message: `${r.member.email} is now ${ROLE_LABEL[r.to]}` });
      }
      case "remove": {
        const m = await removeAdmin(str("artistId"));
        await logAdminAction(admin, "team.remove", { type: "artist", id: m.id }, `Removed ${m.email} from the admin team (was ${ROLE_LABEL[m.adminRole]})`, { was: m.adminRole });
        return NextResponse.json({ ok: true, message: `${m.email} is off the team and signed out` });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof TeamError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("TEAM_ACTION_FAIL", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
