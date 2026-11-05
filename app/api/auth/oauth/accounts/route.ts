// GET    /api/auth/oauth/accounts                    { hasPassword, accounts: [{provider,email,createdAt,lastUsedAt}], available }
// DELETE /api/auth/oauth/accounts?provider=google    disconnect; refused for the last way to sign in
// Connecting goes through GET /api/auth/oauth/<provider>?mode=link.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInMethods } from "@/lib/oauth/account";
import { isProviderId } from "@/lib/oauth/meta";
import { enabledProviders } from "@/lib/oauth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function me() {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ code: "not_logged_in" }, { status: 401 });
  const m = await signInMethods(u.id);
  if (!m) return NextResponse.json({ code: "not_logged_in" }, { status: 401 });
  return NextResponse.json({ ...m, available: enabledProviders() }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request) {
  const u = await me();
  if (!u) return NextResponse.json({ code: "not_logged_in" }, { status: 401 });
  const provider = new URL(req.url).searchParams.get("provider");
  if (!isProviderId(provider)) return NextResponse.json({ code: "bad_provider" }, { status: 400 });

  // Checked and deleted in one transaction so two tabs can't each remove "the other" last method.
  const result = await prisma.$transaction(async (tx) => {
    const a = await tx.artist.findUnique({ where: { id: u.id }, select: { password: true, oauthAccounts: { select: { id: true, provider: true } } } });
    if (!a) return "not_logged_in" as const;
    const mine = a.oauthAccounts.filter((x) => x.provider === provider);
    if (!mine.length) return "not_connected" as const;
    if (!a.password && a.oauthAccounts.length - mine.length < 1) return "last_method" as const;
    await tx.oAuthAccount.deleteMany({ where: { artistId: u.id, provider } });
    return "ok" as const;
  }, { isolationLevel: "Serializable" });

  if (result === "ok") return NextResponse.json({ ok: true });
  const status = result === "not_logged_in" ? 401 : result === "not_connected" ? 404 : 409;
  return NextResponse.json({ code: result }, { status });
}
