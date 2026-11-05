// POST /api/admin/invite/:token  Accept an admin invite as the signed-in account.
// The account's confirmed email must match the invite (lib/adminTeam.ts). The session cookie is re-issued so the
// new ADMIN role applies right away.
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { requireUser, signAuthToken } from "@/lib/auth";
import { TeamError, acceptInvite } from "@/lib/adminTeam";
import { logAdminAction } from "@/lib/audit";
import { ROLE_LABEL, asAdminRole } from "@/lib/adminCaps";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  let a;
  try {
    a = await acceptInvite(params.token, user.id);
  } catch (e) {
    if (e instanceof TeamError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("INVITE_ACCEPT_FAIL", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
  const role = asAdminRole(a.adminRole);
  await logAdminAction({ id: a.id, email: a.email }, "team.invite_accept", { type: "artist", id: a.id }, `${a.email} joined the admin team as ${ROLE_LABEL[role]}`, { role });

  // Same expiry as the current session.
  let exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const old = cookies().get("auth-token")?.value;
  if (old) {
    try {
      const { payload } = await jwtVerify(old, new TextEncoder().encode(process.env.JWT_SECRET!));
      if (payload.exp) exp = payload.exp;
    } catch {}
  }
  const token = await signAuthToken({ id: a.id, email: a.email, slug: a.slug, role: a.role, sessionVersion: a.sessionVersion }, exp);
  const res = NextResponse.json({ ok: true, role });
  const left = exp - Math.floor(Date.now() / 1000);
  const base = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  res.cookies.set("auth-token", token, left > 60 * 60 * 4 ? { ...base, maxAge: left } : base);
  return res;
}
