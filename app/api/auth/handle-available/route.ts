// GET /api/auth/handle-available?h=name[&email=a@b.c]
// Live check for the sign-up form. Returns { available, reason?, suggestions?, emailInUse? }.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkHandle } from "../_lib/handle";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const h = req.nextUrl.searchParams.get("h") || "";
  const email = (req.nextUrl.searchParams.get("email") || "").trim();
  const result: Record<string, unknown> = { ...(await checkHandle(h)) };
  if (email) {
    const hit = await prisma.artist.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    result.emailInUse = Boolean(hit);
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
