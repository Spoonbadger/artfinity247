// Collector rewards: "every 5th print earns 15% off your next order". Server only. OFF by default.
//
// Settings: env wins (COLLECTOR_REWARDS=1|0, COLLECTOR_REWARD_EVERY, COLLECTOR_REWARD_PCT), else the
// `collectorRewards` entry in the admin settings (lib/adminSettings) (set at /admin/settings/rewards), else off / 5 / 15.
//
// No tables: reward n (the nth time the buyer crossed the threshold) has a code signed for (email, n), e.g. THANKS2-7KQ4M9XA.
// Prints are counted from paid retail orders with that email, so earning is derived, not stored. Two log rows in JobRun
// (which already stores JSON details) make it single use and send the email once:
//   job "collector-reward-issued" { email, n, pct }   the code was emailed
//   job "collector-reward-used"   { email, n, orderId } a paid order redeemed it
//
// The discount comes out of Artfinity's share only. Each line's reward is capped at Artfinity's share of that line's
// profit, and the order stores an artist split that keeps the artist's share at what it was before the reward
// (preservedSplit below), so every payout/earnings screen that recomputes from lineTotal + artistSplit pays the artist the same.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { readAdminSettings } from "@/lib/adminSettings";
import { calcItemProfitCents, type PrintSize as RevenueSize } from "@/lib/revenue";
import { resend, emailEnabled } from "@/lib/resend";
import { SITE_URL } from "@/lib/urls";

export type RewardSettings = { enabled: boolean; every: number; pct: number; source: "env" | "file" | "default" };
export const REWARD_DEFAULTS = { enabled: false, every: 5, pct: 15 };

const ISSUED = "collector-reward-issued";
const USED = "collector-reward-used";
const BASE = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, "");

const clampEvery = (v: unknown) => Math.max(2, Math.min(50, Math.round(Number(v)) || REWARD_DEFAULTS.every));
const clampPct = (v: unknown) => Math.max(5, Math.min(30, Math.round(Number(v)) || REWARD_DEFAULTS.pct));

export async function rewardSettings(): Promise<RewardSettings> {
  const env = process.env.COLLECTOR_REWARDS?.trim();
  if (env === "1" || env === "0" || env === "true" || env === "false") {
    return { enabled: env === "1" || env === "true", every: clampEvery(process.env.COLLECTOR_REWARD_EVERY), pct: clampPct(process.env.COLLECTOR_REWARD_PCT), source: "env" };
  }
  const raw = ((await readAdminSettings()) as Record<string, unknown>).collectorRewards as Partial<RewardSettings> | undefined;
  if (raw && typeof raw === "object") return { enabled: raw.enabled === true, every: clampEvery(raw.every), pct: clampPct(raw.pct), source: "file" };
  return { ...REWARD_DEFAULTS, source: "default" };
}

// ---------- Codes ----------

function sig(email: string, n: number) {
  const secret = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";
  const hex = crypto.createHmac("sha256", secret).update(`collector-reward:${email.toLowerCase()}:${n}`).digest("hex");
  // Crockford-ish: digits and letters that don't look alike
  const ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 8; i++) out += ABC[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % ABC.length];
  return out;
}

export const rewardCode = (email: string, n: number) => `THANKS${n}-${sig(email, n)}`;

/** The reward number in a code, when its signature matches this email. */
export function parseRewardCode(code: unknown, email: string): number | null {
  if (typeof code !== "string" || !email) return null;
  const m = /^THANKS(\d{1,4})-([A-Z0-9]{8})$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1) return null;
  const want = Buffer.from(sig(email, n));
  const got = Buffer.from(m[2]);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? n : null;
}

// ---------- Status ----------

/** Prints in paid retail orders with this email. */
export async function printsFor(email: string): Promise<number> {
  const agg = await prisma.orderItem.aggregate({
    _sum: { quantity: true },
    where: { order: { email: { equals: email, mode: "insensitive" }, kind: "retail", paymentStatus: "paid" } },
  });
  return agg._sum.quantity ?? 0;
}

async function usedNumbers(email: string): Promise<Set<number>> {
  const rows = await prisma.jobRun.findMany({ where: { job: USED, details: { path: ["email"], equals: email.toLowerCase() } }, select: { details: true } });
  return new Set(rows.map((r) => Number((r.details as { n?: unknown } | null)?.n)).filter((n) => n > 0));
}

export type RewardStatus = {
  settings: RewardSettings;
  prints: number;
  /** Prints toward the next reward (0..every-1). */
  progress: number;
  /** The oldest earned, unused reward, if any. */
  available: { n: number; code: string; pct: number } | null;
};

export async function rewardStatus(email: string): Promise<RewardStatus> {
  const settings = await rewardSettings();
  const prints = await printsFor(email);
  const earned = Math.floor(prints / settings.every);
  const used = earned ? await usedNumbers(email) : new Set<number>();
  let available: RewardStatus["available"] = null;
  for (let n = 1; n <= earned; n++) {
    if (!used.has(n)) {
      available = { n, code: rewardCode(email, n), pct: settings.pct };
      break;
    }
  }
  return { settings, prints, progress: prints % settings.every, available };
}

/** A code this buyer can use right now: { n, pct }, or null (off, wrong email, not earned, used). */
export async function validateReward(code: unknown, email: string | null | undefined): Promise<{ n: number; pct: number } | null> {
  if (!email) return null;
  const n = parseRewardCode(code, email);
  if (!n) return null;
  const s = await rewardSettings();
  if (!s.enabled) return null;
  if (Math.floor((await printsFor(email)) / s.every) < n) return null;
  if ((await usedNumbers(email)).has(n)) return null;
  return { n, pct: s.pct };
}

// ---------- Money ----------

/**
 * The reward off one print, in cents: pct of the unit price, capped at Artfinity's share of that print's profit
 * (less a cent), so the artist's share never pays for it. `split` is the artist's split for this line.
 */
export function rewardOffUnit(unit: number, pct: number, size: RevenueSize, frameChosen: boolean, split: number, orderDate = new Date()): number {
  const b = calcItemProfitCents({ lineTotal: unit, size, frameChosen, quantity: 1, orderDate, artistSplit: split });
  return Math.max(0, Math.min(Math.round((unit * pct) / 100), b.companyShare - 1));
}

/**
 * The split to store on a rewarded line so the artist's share equals what it was at the pre-reward price.
 * calcItemProfitCents only honors splits strictly between 0 and 1; the cap in rewardOffUnit keeps it below 1.
 */
export function preservedSplit(a: { preRewardLineTotal: number; lineTotal: number; size: RevenueSize; frameChosen: boolean; quantity: number; orderDate: Date; split: number }): number {
  const before = calcItemProfitCents({ lineTotal: a.preRewardLineTotal, size: a.size, frameChosen: a.frameChosen, quantity: a.quantity, orderDate: a.orderDate, artistSplit: a.split });
  const after = calcItemProfitCents({ lineTotal: a.lineTotal, size: a.size, frameChosen: a.frameChosen, quantity: a.quantity, orderDate: a.orderDate, artistSplit: a.split });
  if (after.profit <= 0 || before.artistShare <= 0) return a.split;
  return Math.min(0.9999, Math.max(a.split, before.artistShare / after.profit));
}

/** A paid order redeemed reward n. Safe to call twice (a webhook retry). */
export async function markRewardUsed(email: string, n: number, orderId: string) {
  const e = email.toLowerCase();
  const done = await prisma.jobRun.findFirst({ where: { job: USED, details: { path: ["orderId"], equals: orderId } }, select: { id: true } });
  if (done) return;
  if ((await usedNumbers(e)).has(n)) console.error("[rewards] code used twice; Artfinity covers it", { email: e, n, orderId });
  const now = new Date();
  await prisma.jobRun.create({ data: { job: USED, startedAt: now, finishedAt: now, ok: true, summary: `Collector reward ${n} used on order ${orderId}`, details: { email: e, n, orderId } } });
}

// ---------- Email ----------

/** After a paid order: if the buyer (who has a collection) just earned a reward, email its code once. */
export async function issueRewardIfEarned(email: string) {
  const s = await rewardSettings();
  if (!s.enabled) return;
  const e = email.toLowerCase();
  const n = Math.floor((await printsFor(e)) / s.every);
  if (n < 1 || (await usedNumbers(e)).has(n)) return;
  const sent = await prisma.jobRun.findFirst({ where: { job: ISSUED, AND: [{ details: { path: ["email"], equals: e } }, { details: { path: ["n"], equals: n } }] }, select: { id: true } });
  if (sent) return;
  const now = new Date();
  // Claim first so two webhook deliveries don't both email.
  await prisma.jobRun.create({ data: { job: ISSUED, startedAt: now, finishedAt: now, ok: true, summary: `Collector reward ${n} emailed`, details: { email: e, n, pct: s.pct } } });
  const code = rewardCode(e, n);
  const link = `${BASE}/collector`;
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#15161b;max-width:520px;margin:0 auto;padding:24px">` +
    `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.15">Thank you: ${s.pct}% off your next order</h1>` +
    `<p style="margin:0 0 16px">That's ${n * s.every} prints from independent artists. Your next order is ${s.pct}% off, and Artfinity covers it, so the artist still gets their full share.</p>` +
    `<p style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:.06em">${code}</p>` +
    `<p style="margin:0 0 22px">It's filled in for you at checkout while you're signed in to your collection with this email. One use.</p>` +
    `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#8b2a4b;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">See your collection</a></p>` +
    `<p style="margin:0;font-size:14px">— Artfinity</p></div>`;
  const text = `Thank you: ${s.pct}% off your next order\n\nYour code: ${code}\nFilled in at checkout while you're signed in to your collection with this email. One use.\n\n${link}`;
  const { error } = await resend.emails.send({ from: "Artfinity <notifications@theartfinity.com>", to: e, subject: `${s.pct}% off your next Artfinity order`, html, text });
  if (error) console.error("[rewards] email failed", e, n, error);
  if (!emailEnabled) console.log(`[rewards:dev] reward ${n} for ${e} -> ${code}`);
}
