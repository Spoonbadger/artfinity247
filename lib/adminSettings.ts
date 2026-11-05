// Small admin settings (env wins). Stored as a snapshot row in the audit log (AdminAction "settings.snapshot"),
// so saving works on Vercel, whose file system is read-only; data/admin-settings.json is read as a fallback
// for local copies made before this. Server only.
// TEST_START_DATE (YYYY-MM-DD) starts the 90-day test; without it, the first paid order's date.
import path from "node:path";
import fsp from "node:fs/promises";
import { prisma } from "@/lib/prisma";

const FILE = path.join(process.cwd(), "data", "admin-settings.json");
const ACTION = "settings.snapshot";

/** `social`: Instagram auto-posting (lib/social/settings.ts). */
export type AdminSettings = { testStartDate?: string; testTarget?: number; refundPaidOutPolicy?: string; social?: unknown };

async function readFile(): Promise<AdminSettings> {
  try {
    const raw = JSON.parse(await fsp.readFile(FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export async function readAdminSettings(): Promise<AdminSettings> {
  try {
    const row = await prisma.adminAction.findFirst({ where: { action: ACTION }, orderBy: { createdAt: "desc" }, select: { details: true } });
    if (row?.details && typeof row.details === "object") return row.details as AdminSettings;
  } catch {
    // database unreachable: fall back to the file
  }
  return readFile();
}

export async function writeAdminSettings(patch: AdminSettings, by?: { id?: string; email?: string }) {
  const next = { ...(await readAdminSettings()), ...patch };
  await prisma.adminAction.create({
    data: {
      adminId: by?.id || "system",
      adminEmail: by?.email || "system",
      action: ACTION,
      targetType: "setting",
      summary: `Settings updated: ${Object.keys(patch).join(", ")}`,
      details: next as object,
    },
  });
  return next;
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

/** Where the test's start date comes from, and the date itself ("YYYY-MM-DD") when set. */
export async function testStart(): Promise<{ date: string | null; source: "env" | "file" | "first-order" }> {
  const env = process.env.TEST_START_DATE?.trim();
  if (isDay(env)) return { date: env, source: "env" };
  const s = await readAdminSettings();
  if (isDay(s.testStartDate)) return { date: s.testStartDate, source: "file" }; // "file" = saved in admin settings
  return { date: null, source: "first-order" };
}

export const TEST_TARGET = 100;
export const TEST_DAYS = 90;
