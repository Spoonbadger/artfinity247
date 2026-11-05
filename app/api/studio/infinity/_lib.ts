// Shared bits for /api/studio/infinity/* (signed-in artist, base URL, errors).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { BillingError } from "@/lib/billing";

export async function signedInArtist() {
  const user = await getUserFromCookie();
  if (!user?.id) return null;
  return prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, closedAt: true, suspendedAt: true } });
}

export function baseUrlFrom(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://theartfinity.com";
  }
}

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export function billingFailure(where: string, err: unknown) {
  if (err instanceof BillingError) return fail(err.message, err.status);
  console.error(`[${where}]`, err);
  return fail("Billing is having trouble. Try again in a minute.", 502);
}
