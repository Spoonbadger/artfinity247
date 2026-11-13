// Integrations health for the admin dashboard. Reads env and flags only: never calls Stripe or any other
// service, and never returns a secret's value (only whether it's set, and for Stripe whether it's a test or live key).
import { TAX_ENABLED } from "@/lib/tax";
import { activeProvider } from "@/lib/printer";
import { parseSkuMap, prodigiEnv } from "@/lib/prodigi";
import { cloudinaryOn } from "@/lib/storage";
import { activeProvider as imageCheckProvider, configuredProvider as imageCheckWanted, extraProvider as imageCheckExtra, providerProblem as imageCheckProblem } from "@/lib/moderation/providers";

export type Health = "green" | "amber" | "red";
export type Integration = { id: string; name: string; status: Health; state: string; fix: string | null };

const set = (k: string) => !!process.env[k]?.trim();

/** Prodigi (lib/prodigi.ts): key, SKU map, callback token, sandbox vs live. Never returns a value. */
function prodigiHealth(prod: boolean): Integration {
  const name = "Print lab (Prodigi)";
  if (!set("PRODIGI_API_KEY")) return { id: "printer", name, status: "red", state: "No PRODIGI_API_KEY: work orders fail", fix: "Set PRODIGI_API_KEY from the Prodigi dashboard (DEPLOY.md, Prodigi)." };
  const skus = parseSkuMap(process.env.PRODIGI_SKUS);
  const missingSkus = (["S", "M", "L", "XL"] as const).filter((sz) => !skus.map[sz]).length;
  if (skus.error || missingSkus) return { id: "printer", name, status: "red", state: skus.error || `${missingSkus} print sizes have no SKU`, fix: "Set PRODIGI_SKUS to the confirmed SKUs (DEPLOY.md, Prodigi). Orders with a missing SKU fail and show in /admin/orders." };
  const framesMissing = (["S", "M", "L", "XL"] as const).flatMap((sz) => ["black", "white", "natural"].map((c) => `${sz}:${c}`)).filter((k) => !skus.map[k]).length;
  if (framesMissing) return { id: "printer", name, status: "amber", state: `${framesMissing} of 12 framed options have no SKU`, fix: "Framed orders with a missing SKU fail. Add them to PRODIGI_SKUS (DEPLOY.md, Prodigi)." };
  const env = prodigiEnv();
  if (prod && env === "sandbox") return { id: "printer", name, status: "amber", state: "Sandbox: nothing gets printed", fix: "Set PRODIGI_ENV=live with the live API key once sandbox orders look right." };
  if (!set("PRODIGI_WEBHOOK_TOKEN")) return { id: "printer", name, status: "amber", state: `${env}, no callback token (hourly sync only)`, fix: "Set PRODIGI_WEBHOOK_TOKEN so Prodigi can report status right away." };
  return { id: "printer", name, status: "green", state: `Connected (${env})`, fix: null };
}

export function integrationsHealth(): Integration[] {
  const prod = process.env.NODE_ENV === "production";
  const missing: Health = prod ? "red" : "amber";
  const sk = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const skMode = sk.startsWith("sk_live") || sk.startsWith("rk_live") ? "live" : sk ? "test" : null;
  const out: Integration[] = [];

  out.push(skMode
    ? { id: "stripe", name: "Stripe secret key", status: skMode === "live" || !prod ? "green" : "amber", state: `Set (${skMode} key)`, fix: skMode === "test" && prod ? "Production is using a test key. Swap in the live secret key (Stripe → Developers → API keys)." : null }
    : { id: "stripe", name: "Stripe secret key", status: missing, state: prod ? "Missing: checkout is off" : "Missing: test checkout (no payment)", fix: "Set STRIPE_SECRET_KEY from Stripe → Developers → API keys." });

  out.push(set("STRIPE_WEBHOOK_SECRET")
    ? { id: "stripe-webhook", name: "Stripe webhook secret", status: "green", state: "Set", fix: null }
    : { id: "stripe-webhook", name: "Stripe webhook secret", status: skMode ? "red" : "amber", state: "Missing", fix: "Add a webhook endpoint for /api/webhook in Stripe → Developers → Webhooks, then set STRIPE_WEBHOOK_SECRET to its signing secret. Without it, paid orders aren't recorded." });

  out.push(set("STRIPE_CONNECT_WEBHOOK_SECRET")
    ? { id: "connect-webhook", name: "Connect webhook secret", status: "green", state: "Set", fix: null }
    // Artists are paid only through Stripe Connect, so their payout status has to stay current.
    : { id: "connect-webhook", name: "Connect webhook secret", status: skMode && prod ? "red" : "amber", state: "Missing: artists' Stripe status only updates when they return from Stripe", fix: "Add a Connect webhook (account.updated, account.application.deauthorized) for /api/webhook/connect in Stripe and set STRIPE_CONNECT_WEBHOOK_SECRET. Artists are paid only through Stripe, and the run pays only accounts marked ready." });

  // Infinity billing (lib/billing.ts, BILLING_SETUP.md). Without a Price id, that price comes from lib/plans.ts.
  const billingHook = set("STRIPE_BILLING_WEBHOOK_SECRET");
  const priceId = set("STRIPE_INFINITY_PRICE_ID");
  const yearlyId = set("STRIPE_INFINITY_YEARLY_PRICE_ID");
  out.push(billingHook && priceId && yearlyId
    ? { id: "billing", name: "Infinity billing", status: "green", state: "Set (monthly and yearly)", fix: null }
    : { id: "billing", name: "Infinity billing", status: billingHook ? "green" : "amber", state: billingHook ? `Set (inline ${priceId ? "yearly" : yearlyId ? "monthly" : "monthly and yearly"} price)` : "Webhook secret missing", fix: billingHook ? "Optional: create the Infinity Prices in Stripe and set STRIPE_INFINITY_PRICE_ID and STRIPE_INFINITY_YEARLY_PRICE_ID (BILLING_SETUP.md)." : "Add a webhook for /api/webhook/billing (subscription and invoice events) and set STRIPE_BILLING_WEBHOOK_SECRET. Without it, paid subscriptions don't turn Infinity on. See BILLING_SETUP.md." });

  out.push(TAX_ENABLED
    ? { id: "tax", name: "Stripe Tax", status: "green", state: "On in the app", fix: "Also make sure Tax is switched on in Stripe → Settings → Tax, with a head office address." }
    : { id: "tax", name: "Stripe Tax", status: "amber", state: "Off (STRIPE_TAX=off)", fix: "Remove STRIPE_TAX=off once Stripe Tax is set up, so sales tax is collected." });

  const provider = activeProvider();
  const printerEmail = set("PRINTER_EMAIL");
  out.push(!provider
    ? { id: "printer", name: "Print lab", status: "red", state: "Off: work orders aren't sent", fix: "Set PRINTER_EMAIL to the lab's order inbox (or PRINTER_PROVIDER), or send each order by hand." }
    : provider.id === "email" && !printerEmail
      ? { id: "printer", name: "Print lab", status: missing, state: "Email provider, no PRINTER_EMAIL (logged only)", fix: "Set PRINTER_EMAIL to the lab's order inbox." }
      : provider.id === "prodigi"
        ? prodigiHealth(prod)
      : { id: "printer", name: "Print lab", status: "green", state: `Provider: ${provider.id}${printerEmail ? ", PRINTER_EMAIL set" : ""}`, fix: null });

  out.push(set("RESEND_API_KEY")
    ? { id: "resend", name: "Email (Resend)", status: "green", state: "Set", fix: null }
    : { id: "resend", name: "Email (Resend)", status: missing, state: "Missing: emails only print to the server log", fix: "Set RESEND_API_KEY (resend.com → API keys) and verify the theartfinity.com domain." });

  out.push(cloudinaryOn()
    ? { id: "cloudinary", name: "Cloudinary", status: "green", state: "Set", fix: null }
    : { id: "cloudinary", name: "Cloudinary", status: missing, state: "Missing: uploads save to the server disk", fix: "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET." });

  // Automatic image check on upload (lib/moderation, MODERATION_SETUP.md). Off is fine: uploads go through as before.
  const imgWanted = imageCheckWanted();
  const imgRun = imageCheckProvider();
  const imgProblem = imgRun === "none" ? null : imageCheckProblem(imgRun);
  out.push(imgWanted === "mock" && imgRun === "none"
    ? { id: "image-check", name: "Image check", status: "red", state: "Mock provider set in production: no check runs", fix: "Set IMAGE_MODERATION_PROVIDER to local, sightengine, google or aws (see MODERATION_SETUP.md)." }
    : imgRun === "none"
      ? { id: "image-check", name: "Image check", status: "amber", state: "Off: uploads aren't pre-screened", fix: "Set IMAGE_MODERATION_PROVIDER (local is free; or sightengine, google, aws and their keys). See MODERATION_SETUP.md." }
      : imgProblem
        ? { id: "image-check", name: "Image check", status: prod ? "red" : "amber", state: `${imgRun}: ${imgProblem} (uploads go through unchecked)`, fix: "Add the provider's keys (MODERATION_SETUP.md), or set IMAGE_MODERATION_PROVIDER=none." }
        : { id: "image-check", name: "Image check", status: "green", state: imgRun === "mock" ? "Mock (dev only: reads hints from file names)" : imgRun === "local" ? "Local (NSFWJS on our server, $0): nudity and explicit only" : `Provider: ${imgRun}`, fix: null });

  // The second check for new artists and verification photos (IMAGE_MODERATION_EXTRA, MODERATION_SETUP.md "Tiered checks").
  const extraWanted = (process.env.IMAGE_MODERATION_EXTRA || "").trim().toLowerCase();
  const extraRun = imageCheckExtra();
  if (extraWanted && extraWanted !== "none") {
    out.push(extraRun !== "none"
      ? { id: "image-check-extra", name: "Extra image check", status: "green", state: `${extraRun}: new artists (gore, hate symbols, AI) and verification photos (faces)`, fix: null }
      : { id: "image-check-extra", name: "Extra image check", status: "amber", state: `${extraWanted} is set but can't run (missing keys, same as the main provider, or mock in production)`, fix: "Set SIGHTENGINE_USER and SIGHTENGINE_SECRET (MODERATION_SETUP.md)." });
  } else if (imgRun === "local") {
    out.push({ id: "image-check-extra", name: "Extra image check", status: "amber", state: "Off: new artists' first pieces and verification requests wait for a person", fix: "Set IMAGE_MODERATION_EXTRA=sightengine and its keys (free up to 2,000 operations a month)." });
  }

  out.push(set("PEXELS_API_KEY")
    ? { id: "pexels", name: "Pexels", status: "green", state: "Set", fix: null }
    : { id: "pexels", name: "Pexels", status: "amber", state: "Missing (only for fetching room photos)", fix: "Set PEXELS_API_KEY to run npm run scenes:fetch." });

  // Artfinity's own Instagram (lib/social, SOCIAL_SETUP.md). Off is fine: /admin/social works in manual mode.
  out.push(set("INSTAGRAM_BUSINESS_ACCOUNT_ID") && set("INSTAGRAM_ACCESS_TOKEN")
    ? { id: "instagram", name: "Instagram posting", status: "green", state: "Connected: approved posts publish on schedule", fix: null }
    : { id: "instagram", name: "Instagram posting", status: "amber", state: "Manual mode: admins download and post by hand", fix: "Set INSTAGRAM_BUSINESS_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN (see SOCIAL_SETUP.md, or /admin/social/setup)." });

  out.push(set("CRON_SECRET")
    ? { id: "cron", name: "Cron secret", status: "green", state: "Set", fix: null }
    : { id: "cron", name: "Cron secret", status: prod ? "red" : "amber", state: "Missing: the monthly payout cron does nothing", fix: "Set CRON_SECRET (any long random string); Vercel sends it to /api/cron/payouts." });

  const db = dbHost();
  out.push(!db
    ? { id: "db", name: "Database", status: "red", state: "DATABASE_URL missing", fix: "Set DATABASE_URL to the Postgres connection string." }
    : db.local
      ? { id: "db", name: "Database", status: prod ? "red" : "green", state: `Local (${db.host})`, fix: prod ? "Production points at a local database. Use the hosted Postgres URL." : null }
      : { id: "db", name: "Database", status: "green", state: `Remote (${db.host})`, fix: null });

  const site = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  const localSite = /localhost|127\.0\.0\.1/.test(site);
  out.push(!site
    ? { id: "site", name: "Site URL", status: "amber", state: "Not set: links use https://theartfinity.com", fix: "Set NEXT_PUBLIC_APP_URL (and NEXT_PUBLIC_SITE_URL if different)." }
    : { id: "site", name: "Site URL", status: localSite && prod ? "red" : "green", state: site, fix: localSite && prod ? "Emails and QR links point at localhost. Set NEXT_PUBLIC_APP_URL to the real domain." : null });

  return out;
}

/** Host of DATABASE_URL only (never user or password). */
function dbHost(): { host: string; local: boolean } | null {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname || "socket";
    return { host, local: /^(localhost|127\.0\.0\.1|::1|socket|db|postgres)$/.test(host) };
  } catch {
    return { host: "unparsable", local: false };
  }
}
