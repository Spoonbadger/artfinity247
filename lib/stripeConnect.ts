// Stripe Connect (Express) for artist payouts. Server only.
//
// Artists connect a Stripe Express account (transfers only) from /studio/money. Once Stripe says the account
// can receive transfers and pay out, Artist.stripePayoutsEnabled is true and the monthly payout goes to their bank
// as a Stripe Transfer (lib/payouts.ts). This is the only way artists are paid: until an artist's account is ready,
// their earnings are held in their balance and paid on the first run after they connect.
//
// Without STRIPE_SECRET_KEY (localhost, or a staging site with ALLOW_TEST_CHECKOUT=1) connecting is SIMULATED:
// the artist gets a fake "acct_sim_..." id and is ready at once, and "Pay all" records fake "tr_sim_..." transfers.
// Same gate as test checkout (lib/testCheckout.ts), so a production site never simulates. A simulated id is
// ignored once real keys are set.
import Stripe from "stripe";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { testCheckoutAllowed } from "@/lib/testCheckout";
import { SITE_URL, artistUrl } from "@/lib/urls";

export const STRIPE_API_VERSION = "2025-08-27.basil" as const;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");

const SIM_ACCOUNT = "acct_sim_";
export const SIM_TRANSFER = "tr_sim_";

let client: Stripe | null = null;
/** The Stripe client, or null without STRIPE_SECRET_KEY. */
export function stripeOrNull(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  return client;
}

/** "live": real Stripe. "simulated": no keys, dev or staging. "off": no keys in production (nothing to do). */
export type ConnectMode = "live" | "simulated" | "off";
export function connectMode(): ConnectMode {
  if (process.env.STRIPE_SECRET_KEY) return "live";
  return testCheckoutAllowed() ? "simulated" : "off";
}

export const isSimAccount = (id: string | null | undefined) => !!id && id.startsWith(SIM_ACCOUNT);

export type ConnectStatus = "not_connected" | "pending" | "ready";

/** The artist's Stripe status, as the app should treat it right now (a simulated id doesn't count against real Stripe). */
export function connectStatus(a: { stripeAccountId: string | null; stripePayoutsEnabled: boolean }, mode: ConnectMode = connectMode()): ConnectStatus {
  if (!a.stripeAccountId || mode === "off") return "not_connected";
  if (isSimAccount(a.stripeAccountId) !== (mode === "simulated")) return "not_connected";
  return a.stripePayoutsEnabled ? "ready" : "pending";
}

/** Ready to get paid by Stripe: transfers capability active and payouts enabled on the account. */
export function accountReady(acct: Pick<Stripe.Account, "payouts_enabled" | "capabilities">) {
  return !!acct.payouts_enabled && acct.capabilities?.transfers === "active";
}

/** Writes the account's readiness to the artist row. Returns the new value. */
export async function syncAccount(acct: Stripe.Account): Promise<boolean> {
  const ready = accountReady(acct);
  await prisma.artist.updateMany({ where: { stripeAccountId: acct.id }, data: { stripePayoutsEnabled: ready } });
  return ready;
}

export class ConnectError extends Error {}

/**
 * Where "Connect with Stripe" / "Finish setup" sends the artist: a Stripe onboarding link
 * (creating their Express account first), or straight back to Money when simulated.
 */
export async function onboardingUrl(artistId: string): Promise<string> {
  const mode = connectMode();
  if (mode === "off") throw new ConnectError("Stripe isn't set up here.");
  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { id: true, email: true, first_name: true, last_name: true, slug: true, stripeAccountId: true },
  });
  if (!artist) throw new ConnectError("Account not found.");

  if (mode === "simulated") {
    const id = isSimAccount(artist.stripeAccountId) ? artist.stripeAccountId! : `${SIM_ACCOUNT}${randomBytes(8).toString("hex")}`;
    await prisma.artist.update({ where: { id: artist.id }, data: { stripeAccountId: id, stripePayoutsEnabled: true } });
    console.log(`[stripe:sim] connected artist ${artist.id} as ${id}`);
    return "/studio/money?stripe=simulated";
  }

  const stripe = stripeOrNull()!;
  let accountId = artist.stripeAccountId && !isSimAccount(artist.stripeAccountId) ? artist.stripeAccountId : null;
  if (!accountId) {
    const acct = await stripe.accounts.create(
      {
        type: "express",
        country: "US",
        email: artist.email,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        individual: { email: artist.email, first_name: artist.first_name || undefined, last_name: artist.last_name || undefined },
        business_profile: {
          product_description: "Artist selling art prints through Artfinity",
          // Stripe rejects localhost URLs, so only a public site's profile link is sent.
          ...(artist.slug && /^https:\/\/(?!localhost)/.test(SITE_URL) ? { url: artistUrl(artist.slug) } : {}),
        },
        metadata: { artistId: artist.id },
      },
      // One account per artist even if they double-click.
      { idempotencyKey: `connect-account:${artist.id}` },
    );
    accountId = acct.id;
    // Only set it if nobody else did in the meantime (two tabs).
    const { count } = await prisma.artist.updateMany({
      where: { id: artist.id, OR: [{ stripeAccountId: null }, { stripeAccountId: { startsWith: SIM_ACCOUNT } }] },
      data: { stripeAccountId: accountId, stripePayoutsEnabled: false },
    });
    if (!count) accountId = (await prisma.artist.findUnique({ where: { id: artist.id }, select: { stripeAccountId: true } }))!.stripeAccountId!;
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/api/studio/stripe/refresh`,
    return_url: `${APP_URL}/api/studio/stripe/return`,
    type: "account_onboarding",
  });
  return link.url;
}

/** "Manage in Stripe": a one-time Express dashboard login link. Falls back to onboarding if setup isn't finished. */
export async function dashboardUrl(artistId: string): Promise<string> {
  const mode = connectMode();
  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { stripeAccountId: true, stripePayoutsEnabled: true } });
  const status = artist ? connectStatus(artist, mode) : "not_connected";
  if (status === "not_connected") return onboardingUrl(artistId);
  if (mode === "simulated") return "/studio/money?stripe=simulated-dashboard";
  const stripe = stripeOrNull()!;
  const acct = await stripe.accounts.retrieve(artist!.stripeAccountId!);
  await syncAccount(acct);
  if (!acct.details_submitted) return onboardingUrl(artistId);
  return (await stripe.accounts.createLoginLink(acct.id)).url;
}

/** After Stripe sends the artist back: re-read the account so the Money page is right without waiting for the webhook. */
export async function refreshFromStripe(artistId: string): Promise<ConnectStatus> {
  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { stripeAccountId: true, stripePayoutsEnabled: true } });
  if (!artist) return "not_connected";
  const stripe = stripeOrNull();
  if (stripe && artist.stripeAccountId && !isSimAccount(artist.stripeAccountId)) {
    const ready = await syncAccount(await stripe.accounts.retrieve(artist.stripeAccountId));
    return ready ? "ready" : "pending";
  }
  return connectStatus(artist);
}

/** What Stripe is waiting for, in plain words (account.requirements keys). */
const NEEDS: [RegExp, string][] = [
  [/external_account/, "your bank account"],
  [/verification\.(additional_)?document/, "a photo of your ID"],
  [/id_number|ssn_last_4/, "your Social Security number"],
  [/dob/, "your date of birth"],
  [/address/, "your address"],
  [/phone/, "your phone number"],
  [/tos_acceptance/, "you to accept Stripe's terms"],
  [/first_name|last_name/, "your legal name"],
];
const needWords = (keys: string[]) => {
  const words = Array.from(new Set(keys.map((k) => NEEDS.find(([re]) => re.test(k))?.[1]).filter(Boolean) as string[]));
  if (!words.length) return "a few more details";
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
};

/**
 * Why payouts aren't on yet, for the Money page (only asked while the status is "pending"):
 *   setup    onboarding not finished           → Finish setup
 *   paused   was set up, Stripe now needs more  → Finish setup (Stripe's own form)
 *   review   Stripe is reviewing or refused     → Message us
 * Never throws: on any Stripe error it falls back to "setup".
 */
export type ConnectDetail = { state: "setup" | "paused" | "review"; reason: string };
export async function connectDetail(artistId: string): Promise<ConnectDetail | null> {
  const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { stripeAccountId: true, stripePayoutsEnabled: true } });
  if (!artist || connectStatus(artist) !== "pending") return null;
  if (isSimAccount(artist.stripeAccountId)) return { state: "paused", reason: "Payouts are paused on this test account." };
  const stripe = stripeOrNull();
  if (!stripe) return null;
  try {
    const acct = await stripe.accounts.retrieve(artist.stripeAccountId!);
    const r = acct.requirements;
    const due = [...(r?.past_due ?? []), ...(r?.currently_due ?? [])];
    const why = r?.disabled_reason ?? "";
    if (why.startsWith("rejected") || why === "under_review" || why === "requirements.pending_verification") {
      return why === "requirements.pending_verification" || why === "under_review"
        ? { state: "review", reason: "Stripe is checking your details. This usually takes a day or two." }
        : { state: "review", reason: "Stripe couldn't approve this account. Message us and we'll help sort it out." };
    }
    if (!acct.details_submitted) return { state: "setup", reason: `Stripe still needs ${needWords(due)}.` };
    return { state: "paused", reason: `Payouts are paused: Stripe needs ${needWords(due)}.` };
  } catch (err) {
    console.error("[stripe connect] detail failed", err);
    return { state: "setup", reason: "Stripe needs a few more details." };
  }
}
