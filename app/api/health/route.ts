// GET /api/health  For uptime monitors (UptimeRobot, Better Stack, ...): 200 when the app and database answer,
// 503 when the database doesn't. Public and cheap: no secrets, no counts, no personal data. HEAD works too.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import pkg from "@/package.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_TIMEOUT_MS = 5000;

async function check() {
  const started = Date.now();
  let db: "ok" | "down" = "ok";
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS)),
    ]);
  } catch {
    db = "down";
  }
  const body = {
    status: db === "ok" ? "ok" : "degraded",
    db,
    dbMs: Date.now() - started,
    version: pkg.version,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: db === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return check();
}

export async function HEAD() {
  const r = await check();
  return new Response(null, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
