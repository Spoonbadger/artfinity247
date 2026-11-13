import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { getBalance } from "@/lib/balance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The signed-in artist's balance, ledger and payouts (lib/balance.ts), as JSON. */
export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const balance = await getBalance(user.id);
  return NextResponse.json(balance, { headers: { "Cache-Control": "no-store" } });
}
