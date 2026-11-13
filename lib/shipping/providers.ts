// Carrier tracking providers (Shippo or EasyPost). Server only.
//
// We don't buy labels through them: the print lab ships. We only register each tracking number so the provider calls
// our webhook (app/api/shipping/webhook) as the parcel moves, which marks orders shipped/delivered by themselves.
//
// Env (one provider; Shippo wins if both are set):
//   SHIPPO_API_KEY            Shippo API token ("shippo_live_…" or "shippo_test_…")
//   EASYPOST_API_KEY          EasyPost API key
//   SHIPPING_WEBHOOK_SECRET   Shared secret. Shippo: add ?token=<secret> to the webhook URL. EasyPost: set it as the
//                             webhook secret (HMAC in X-Hmac-Signature); ?token=<secret> also works.
// Without a key, nothing is registered. Outside production an admin can simulate events (app/api/shipping/mock).
import crypto from "crypto";
import type { Carrier } from "@/lib/tracking";

export type ShipStatus = "pre_transit" | "in_transit" | "delivered" | "problem" | "unknown";

export type TrackingEvent = {
  provider: ProviderId;
  trackingNumber: string;
  carrier: string | null;
  status: ShipStatus;
  at: Date;
  /** Our order id, when the provider echoes the metadata we registered with. */
  orderId: string | null;
  detail: string;
};

export type ProviderId = "shippo" | "easypost" | "mock";

export interface ShippingProvider {
  id: ProviderId;
  /** Starts tracking the parcel. Returns the provider's tracker id. Throws on failure. */
  register(t: { carrier: Carrier; number: string; orderId: string }): Promise<string>;
  /** Reads a webhook body into an event, or null when it isn't a tracking update. */
  parse(body: unknown): TrackingEvent | null;
}

const TIMEOUT_MS = 10_000;

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  try { return JSON.parse(text) as Record<string, any>; } catch { return {}; }
}

const date = (v: unknown) => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : new Date();
};

const orderFromMeta = (m: unknown) => (typeof m === "string" && m.startsWith("order:") ? m.slice(6) : null);

// ---------- Shippo ----------

const SHIPPO_CARRIER: Partial<Record<Carrier, string>> = { USPS: "usps", UPS: "ups", FedEx: "fedex" };
const SHIPPO_STATUS: Record<string, ShipStatus> = { PRE_TRANSIT: "pre_transit", TRANSIT: "in_transit", DELIVERED: "delivered", RETURNED: "problem", FAILURE: "problem", UNKNOWN: "unknown" };

const shippo = (key: string): ShippingProvider => ({
  id: "shippo",
  async register({ carrier, number, orderId }) {
    const code = SHIPPO_CARRIER[carrier];
    if (!code) throw new Error(`Shippo can't track ${carrier} numbers.`);
    const r = await post("https://api.goshippo.com/tracks/", { Authorization: `ShippoToken ${key}` }, { carrier: code, tracking_number: number, metadata: `order:${orderId}` });
    return String(r.object_id || r.tracking_number || number);
  },
  parse(body) {
    const b = body as { event?: string; data?: any };
    const d = b?.data;
    if (!d?.tracking_number || (b.event && b.event !== "track_updated")) return null;
    const s = d.tracking_status ?? {};
    return {
      provider: "shippo",
      trackingNumber: String(d.tracking_number),
      carrier: d.carrier ? String(d.carrier) : null,
      status: SHIPPO_STATUS[String(s.status || "UNKNOWN").toUpperCase()] ?? "unknown",
      at: date(s.status_date),
      orderId: orderFromMeta(d.metadata),
      detail: String(s.status_details || s.status || ""),
    };
  },
});

// ---------- EasyPost ----------

const EASYPOST_CARRIER: Partial<Record<Carrier, string>> = { USPS: "USPS", UPS: "UPS", FedEx: "FedEx" };
const EASYPOST_STATUS: Record<string, ShipStatus> = {
  pre_transit: "pre_transit", in_transit: "in_transit", out_for_delivery: "in_transit", available_for_pickup: "in_transit",
  delivered: "delivered", return_to_sender: "problem", failure: "problem", error: "problem", cancelled: "problem", unknown: "unknown",
};

const easypost = (key: string): ShippingProvider => ({
  id: "easypost",
  async register({ carrier, number }) {
    const code = EASYPOST_CARRIER[carrier];
    if (!code) throw new Error(`EasyPost can't track ${carrier} numbers.`);
    const r = await post("https://api.easypost.com/v2/trackers", { Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }, { tracker: { tracking_code: number, carrier: code } });
    return String(r.id || number);
  },
  parse(body) {
    const b = body as { description?: string; result?: any };
    const t = b?.result;
    if (!t?.tracking_code || (b.description && !String(b.description).startsWith("tracker."))) return null;
    const last = Array.isArray(t.tracking_details) && t.tracking_details.length ? t.tracking_details[t.tracking_details.length - 1] : null;
    return {
      provider: "easypost",
      trackingNumber: String(t.tracking_code),
      carrier: t.carrier ? String(t.carrier) : null,
      status: EASYPOST_STATUS[String(t.status || "unknown")] ?? "unknown",
      at: date(last?.datetime || t.updated_at),
      orderId: null,
      detail: String(last?.message || t.status_detail || t.status || ""),
    };
  },
});

// ---------- Mock (development only) ----------

/** Parses the Shippo shape, so a simulated event goes through the same code as a real one. Never active in production. */
const mock: ShippingProvider = {
  id: "mock",
  async register({ number, orderId }) {
    console.log(`[shipping:mock] tracking ${number} registered for order ${orderId}. Simulate: POST /api/shipping/mock {"orderId":"${orderId}","status":"in_transit"|"delivered"}`);
    return `mock_${number}`;
  },
  parse: (body) => {
    const e = shippo("").parse(body);
    return e && { ...e, provider: "mock" };
  },
};

export const isProduction = () => process.env.NODE_ENV === "production";
export const mockAllowed = () => !isProduction();

/** The configured provider, the mock in development, or null (production without keys: tracking stays manual). */
export function shippingProvider(): ShippingProvider | null {
  const sk = process.env.SHIPPO_API_KEY?.trim();
  if (sk) return shippo(sk);
  const ek = process.env.EASYPOST_API_KEY?.trim();
  if (ek) return easypost(ek);
  return mockAllowed() ? mock : null;
}

/** Every parser, to read a webhook body whichever provider sent it. */
export function parseWebhook(body: unknown): TrackingEvent | null {
  const p = shippingProvider();
  if (p) {
    const e = p.parse(body);
    if (e) return e;
  }
  return shippo("").parse(body) ?? easypost("").parse(body);
}

// ---------- Webhook auth ----------

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * "ok" when the request carries the shared secret (?token= or EasyPost's HMAC header), "unconfigured" when no secret is
 * set (refused in production, allowed in development so payloads can be tried locally), else "denied".
 */
export function checkWebhook(rawBody: string, url: URL, headers: Headers): "ok" | "unconfigured" | "denied" {
  const secret = process.env.SHIPPING_WEBHOOK_SECRET?.trim();
  if (!secret) return "unconfigured";
  const token = url.searchParams.get("token");
  if (token && safeEqual(token, secret)) return "ok";
  const sig = headers.get("x-hmac-signature");
  if (sig) {
    const want = `hmac-sha256-hex=${crypto.createHmac("sha256", secret.normalize("NFKD")).update(rawBody, "utf8").digest("hex")}`;
    if (safeEqual(sig, want)) return "ok";
  }
  return "denied";
}
