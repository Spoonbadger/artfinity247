// Integrations health for the admin dashboard. Reads env and flags only: never calls Stripe or any other
// service, and never returns a secret's value (only whether it's set, and for Stripe whether it's a test or live key).
import { TAX_ENABLED } from "@/lib/tax";
import { activeProvider } from "@/lib/printer";
import { cloudinaryOn } from "@/lib/storage";

export type Health = "green" | "amber" | "red";
export type Integration = { id: string; name: string; status: Health; state: string; fix: string | null };

const set = (k: string) => !!process.env[k]?.trim();

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
    : { id: "connect-webhook", name: "Connect webhook secret", status: "amber", state: "Missing", fix: "Add a Connect webhook (account.updated) in Stripe and set STRIPE_CONNECT_WEBHOOK_SECRET, so artists' Stripe setup status updates by itself." });

  out.push(TAX_ENABLED
    ? { id: "tax", name: "Stripe Tax", status: "green", state: "On in the app", fix: "Also make sure Tax is switched on in Stripe → Settings → Tax, with a head office address." }
    : { id: "tax", name: "Stripe Tax", status: "amber", state: "Off (STRIPE_TAX=off)", fix: "Remove STRIPE_TAX=off once Stripe Tax is set up, so sales tax is collected." });

  const provider = activeProvider();
  const printerEmail = set("PRINTER_EMAIL");
  out.push(!provider
    ? { id: "printer", name: "Print lab", status: "red", state: "Off: work orders aren't sent", fix: "Set PRINTER_EMAIL to the lab's order inbox (or PRINTER_PROVIDER), or send each order by hand." }
    : provider.id === "email" && !printerEmail
      ? { id: "printer", name: "Print lab", status: missing, state: "Email provider, no PRINTER_EMAIL (logged only)", fix: "Set PRINTER_EMAIL to the lab's order inbox." }
      : { id: "printer", name: "Print lab", status: "green", state: `Provider: ${provider.id}${printerEmail ? ", PRINTER_EMAIL set" : ""}`, fix: null });

  out.push(set("RESEND_API_KEY")
    ? { id: "resend", name: "Email (Resend)", status: "green", state: "Set", fix: null }
    : { id: "resend", name: "Email (Resend)", status: missing, state: "Missing: emails only print to the server log", fix: "Set RESEND_API_KEY (resend.com → API keys) and verify the theartfinity.com domain." });

  out.push(cloudinaryOn()
    ? { id: "cloudinary", name: "Cloudinary", status: "green", state: "Set", fix: null }
    : { id: "cloudinary", name: "Cloudinary", status: missing, state: "Missing: uploads save to the server disk", fix: "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET." });

  out.push(set("PEXELS_API_KEY")
    ? { id: "pexels", name: "Pexels", status: "green", state: "Set", fix: null }
    : { id: "pexels", name: "Pexels", status: "amber", state: "Missing (only for fetching room photos)", fix: "Set PEXELS_API_KEY to run npm run scenes:fetch." });

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
