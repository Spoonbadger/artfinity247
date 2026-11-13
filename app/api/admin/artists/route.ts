// POST /api/admin/artists  { artist_name, handle, email, city, first_name? }  Owner or admin.
// Make an artist account by hand (someone met at a market). No password: they get a "set your password" email.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { AccountError, createAccountByAdmin, sendSetPasswordInvite } from "@/lib/adminAccounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("accounts");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const a = await createAccountByAdmin(input);
    const me = await prisma.artist.findUnique({ where: { id: admin.id }, select: { first_name: true, artist_name: true, name: true } });
    let emailed = true;
    try {
      await sendSetPasswordInvite(a.id, me?.first_name || me?.artist_name || me?.name || "The team");
    } catch (e) {
      emailed = false;
      console.error("SET_PASSWORD_INVITE_FAIL", e);
    }
    await logAdminAction(admin, "artist.create", { type: "artist", id: a.id }, `Created an account for ${a.artist_name} (@${a.slug}, ${a.email})`, { email: a.email, slug: a.slug, inviteEmailed: emailed });
    return NextResponse.json({ ok: true, id: a.id, message: emailed ? `Account made. ${a.email} got a “set your password” email.` : "Account made, but the email didn't send. Use “Send password reset link”." });
  } catch (e) {
    if (e instanceof AccountError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("ADMIN_CREATE_ACCOUNT_FAIL", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
