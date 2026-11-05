// Small admin settings kept in data/admin-settings.json (env wins). Server only.
// TEST_START_DATE (YYYY-MM-DD) starts the 90-day test; without it, the first paid order's date.
import path from "node:path";
import fsp from "node:fs/promises";

const FILE = path.join(process.cwd(), "data", "admin-settings.json");

export type AdminSettings = { testStartDate?: string; testTarget?: number };

export async function readAdminSettings(): Promise<AdminSettings> {
  try {
    const raw = JSON.parse(await fsp.readFile(FILE, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export async function writeAdminSettings(patch: AdminSettings) {
  const next = { ...(await readAdminSettings()), ...patch };
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  await fsp.writeFile(FILE, JSON.stringify(next, null, 2) + "\n");
  return next;
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

/** Where the test's start date comes from, and the date itself ("YYYY-MM-DD") when set. */
export async function testStart(): Promise<{ date: string | null; source: "env" | "file" | "first-order" }> {
  const env = process.env.TEST_START_DATE?.trim();
  if (isDay(env)) return { date: env, source: "env" };
  const s = await readAdminSettings();
  if (isDay(s.testStartDate)) return { date: s.testStartDate, source: "file" };
  return { date: null, source: "first-order" };
}

export const TEST_TARGET = 100;
export const TEST_DAYS = 90;
