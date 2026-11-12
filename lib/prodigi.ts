// Prodigi (prodigi.com) Print API v4: the order payload, the SKU map, reading callbacks and turning Prodigi's order
// status into our order steps. Server only, but no imports from the app (only node:crypto and global fetch), so
// lib/prodigi.test.mjs can run it with plain Node. The database side is lib/prodigiSync.ts; the provider that sends
// work orders is in lib/printer.ts (PRINTER_PROVIDER=prodigi).
//
// The live docs (https://www.prodigi.com/print-api/docs/reference/) couldn't be fetched while this was written.
// Field names follow Prodigi API v4 as we know it; anything not confirmed is marked "Unverified against live docs".
// Check them against a sandbox order before going live (DEPLOY.md, "Prodigi").
//
// Env:
//   PRODIGI_API_KEY           API key (Prodigi dashboard, Settings > Integrations > API). Sent as X-API-Key. Never logged.
//   PRODIGI_ENV               sandbox (default) | live
//   PRODIGI_SKUS              JSON map of size (+ frame colour) to SKU. See SKU_MAP_EXAMPLE. Required.
//   PRODIGI_SHIPPING_METHOD   Budget | Standard (default) | Express | Overnight
//   PRODIGI_WEBHOOK_TOKEN     Secret in the callback URL (?token=). Prodigi callbacks aren't signed.
//   PRODIGI_PACKING_SLIP      "on" sends our packing slip URL with the order (off by default, unverified field)
//   PRODIGI_DASHBOARD_URL     Override for the dashboard link on the admin order page ({id} is the Prodigi order id)
//   PRODIGI_API_URL           Development only: a local mock (http://localhost:<port>). Ignored in production.
import crypto from "node:crypto";

// ---------- Config ----------

export type ProdigiEnv = "sandbox" | "live";
export type Env = Record<string, string | undefined>;

export const prodigiEnv = (env: Env = process.env): ProdigiEnv => ((env.PRODIGI_ENV || "").trim().toLowerCase() === "live" ? "live" : "sandbox");

/** PRODIGI_API_URL points at a local mock, outside production only (so the key can never be sent elsewhere live). */
export function prodigiBaseUrl(env: Env = process.env): string {
  const mock = env.PRODIGI_API_URL?.trim();
  if (mock && env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(mock)) return mock;
  return prodigiEnv(env) === "live" ? "https://api.prodigi.com" : "https://api.sandbox.prodigi.com";
}

export const SHIPPING_METHODS = ["Budget", "Standard", "Express", "Overnight"] as const;

export function shippingMethod(env: Env = process.env): string {
  const raw = (env.PRODIGI_SHIPPING_METHOD || "").trim().toLowerCase();
  return SHIPPING_METHODS.find((m) => m.toLowerCase() === raw) ?? "Standard";
}

/**
 * Link to the order in Prodigi's dashboard.
 * Unverified against live docs: the dashboard hosts and the /orders/<id> path. PRODIGI_DASHBOARD_URL overrides it
 * (e.g. "https://dashboard.prodigi.com/orders/{id}").
 */
export function dashboardUrl(prodigiOrderId: string, env: Env = process.env): string {
  const id = encodeURIComponent(prodigiOrderId);
  const custom = env.PRODIGI_DASHBOARD_URL?.trim();
  if (custom) return custom.includes("{id}") ? custom.replace("{id}", id) : `${custom.replace(/\/$/, "")}/${id}`;
  return prodigiEnv(env) === "live" ? `https://dashboard.prodigi.com/orders/${id}` : `https://sandbox-beta-dashboard.pwinty.com/orders/${id}`;
}

// ---------- SKU map ----------

export type SizeCode = "S" | "M" | "L" | "XL";
export type SkuEntry = { sku: string; attributes?: Record<string, string> };
export type SkuMap = Record<string, SkuEntry>;

const SIZE_TEXT: Record<SizeCode, string> = { S: "S (5×7)", M: "M (8×12)", L: "L (11×17)", XL: "XL (18×24)" };

/**
 * The shape PRODIGI_SKUS takes. Keys: "<size>" for a print without a frame, "<size>:<frame colour>" for a framed one
 * (frame colours are black, white and natural, components/art/pricing.ts FRAME_COLORS). A value is a SKU string, or
 * { "sku": "...", "attributes": { ... } } when the product needs attributes (framed products usually take a colour).
 *
 * TODO(thomas): confirm SKUs in the Prodigi dashboard (product catalogue) for 310gsm smooth matte fine art paper and
 * each frame. Every value below is a placeholder: anything starting with "TODO" counts as missing, so an order with
 * that size or frame fails with a clear reason in /admin/orders instead of printing the wrong product.
 */
export const SKU_MAP_EXAMPLE: Record<string, string | SkuEntry> = {
  S: "TODO-fine-art-310gsm-5x7",
  M: "TODO-fine-art-310gsm-8x12",
  L: "TODO-fine-art-310gsm-11x17",
  XL: "TODO-fine-art-310gsm-18x24",
  "S:black": { sku: "TODO-framed-5x7", attributes: { color: "TODO-black" } },
  "S:white": { sku: "TODO-framed-5x7", attributes: { color: "TODO-white" } },
  "S:natural": { sku: "TODO-framed-5x7", attributes: { color: "TODO-natural" } },
  "M:black": { sku: "TODO-framed-8x12", attributes: { color: "TODO-black" } },
  "M:white": { sku: "TODO-framed-8x12", attributes: { color: "TODO-white" } },
  "M:natural": { sku: "TODO-framed-8x12", attributes: { color: "TODO-natural" } },
  "L:black": { sku: "TODO-framed-11x17", attributes: { color: "TODO-black" } },
  "L:white": { sku: "TODO-framed-11x17", attributes: { color: "TODO-white" } },
  "L:natural": { sku: "TODO-framed-11x17", attributes: { color: "TODO-natural" } },
  "XL:black": { sku: "TODO-framed-18x24", attributes: { color: "TODO-black" } },
  "XL:white": { sku: "TODO-framed-18x24", attributes: { color: "TODO-white" } },
  "XL:natural": { sku: "TODO-framed-18x24", attributes: { color: "TODO-natural" } },
};

const isPlaceholder = (v: string) => !v.trim() || /^todo/i.test(v.trim());

/** Reads PRODIGI_SKUS. Placeholder ("TODO…") and empty values are dropped, so they count as missing. */
export function parseSkuMap(raw: string | undefined | null): { map: SkuMap; error: string | null } {
  if (!raw || !raw.trim()) return { map: {}, error: "PRODIGI_SKUS isn't set." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { map: {}, error: "PRODIGI_SKUS isn't valid JSON." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { map: {}, error: "PRODIGI_SKUS must be a JSON object." };
  const map: SkuMap = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const key = skuKeyNormalize(k);
    if (!key) continue;
    let entry: SkuEntry | null = null;
    if (typeof v === "string") entry = { sku: v.trim() };
    else if (v && typeof v === "object" && typeof (v as SkuEntry).sku === "string") {
      const attrs = (v as SkuEntry).attributes;
      const clean: Record<string, string> = {};
      let bad = false;
      if (attrs && typeof attrs === "object") {
        for (const [ak, av] of Object.entries(attrs)) {
          if (typeof av !== "string" || isPlaceholder(av)) bad = true;
          else clean[ak] = av.trim();
        }
      }
      entry = bad ? null : { sku: (v as SkuEntry).sku.trim(), ...(Object.keys(clean).length ? { attributes: clean } : {}) };
    }
    if (entry && !isPlaceholder(entry.sku)) map[key] = entry;
  }
  return { map, error: null };
}

function skuKeyNormalize(k: string): string | null {
  const m = k.trim().match(/^(S|M|L|XL)(?::([a-z]+))?$/i);
  if (!m) return null;
  return m[2] ? `${m[1].toUpperCase()}:${m[2].toLowerCase()}` : m[1].toUpperCase();
}

export const skuKey = (size: SizeCode, frame: string | null) => (frame ? `${size}:${frame.toLowerCase()}` : size);

/** The SKU for a print, or an Error saying exactly which key is missing. */
export function resolveSku(map: SkuMap, size: SizeCode, frame: string | null): SkuEntry {
  const key = skuKey(size, frame);
  const hit = map[key];
  if (hit) return hit;
  const what = `${SIZE_TEXT[size] ?? size}${frame ? ` with a ${frame} frame` : " without a frame"}`;
  throw new Error(`No Prodigi SKU for ${what}. Add "${key}" to PRODIGI_SKUS (see DEPLOY.md, Prodigi).`);
}

// ---------- Address ----------

export type ProdigiRecipient = {
  name: string;
  address: { line1: string; line2?: string; postalOrZipCode: string; countryCode: string; townOrCity: string; stateOrCounty?: string };
};

/**
 * Order.shippingAddress is one line, written by lib/checkoutSession.ts shippingFrom (and the bulk route):
 * "12 Orchard St, Apt 4B, New York, NY 10002, US". Read back from the end: country, "STATE ZIP", city, street lines.
 */
export function parseRecipient(name: string | null, address: string | null): ProdigiRecipient {
  const parts = (address || "").split(",").map((p) => p.trim()).filter(Boolean);
  const bad = () => new Error("Can't read the shipping address for Prodigi. Fix it on the order, then retry.");
  if (parts.length < 4) throw bad();
  const country = parts[parts.length - 1].toUpperCase();
  const stateZip = parts[parts.length - 2];
  const city = parts[parts.length - 3];
  const lines = parts.slice(0, parts.length - 3);
  if (!/^[A-Z]{2}$/.test(country) || !city || !lines[0]) throw bad();
  const m = stateZip.match(/^(.*?)\s*([A-Za-z0-9-]{3,10})$/);
  if (!m) throw bad();
  const state = m[1].trim();
  const zip = m[2];
  if (country === "US" && !/^\d{5}(-\d{4})?$/.test(zip)) throw bad();
  const n = (name || "").trim();
  if (!n) throw new Error("The order has no ship-to name. Add one, then retry.");
  return {
    name: n,
    address: {
      line1: lines[0],
      ...(lines.length > 1 ? { line2: lines.slice(1).join(", ") } : {}),
      postalOrZipCode: zip,
      countryCode: country,
      townOrCity: city,
      ...(state ? { stateOrCounty: state } : {}),
    },
  };
}

// ---------- Order payload ----------

export type PayloadItem = { id: string; title: string; size: SizeCode; frame: string | null; quantity: number; assetUrl: string | null };

export type PayloadInput = {
  orderId: string;
  /** Our order number (lib/printer.ts orderNumber). */
  number: string;
  shipName: string | null;
  shipAddress: string | null;
  reprintOf: string | null;
  items: PayloadItem[];
};

export type PayloadConfig = {
  skus: SkuMap;
  shippingMethod: string;
  callbackUrl: string | null;
  idempotencyKey: string;
  packingSlipUrl?: string | null;
};

/**
 * "fitPrintArea", not "fillPrintArea". Fill scales the image to cover the whole print area and crops what overhangs,
 * which would cut the edges off a painting whose proportions don't match the paper (8×12 is 2:3, 11×17 isn't, 18×24
 * is 3:4). Fit keeps the whole artwork and leaves the leftover paper white, which is what our ½-inch white border
 * already asks for: nothing of the art is lost, and the margin is plain paper.
 * TODO(thomas): Prodigi doesn't add a fixed ½-inch border by itself. Confirm with a sandbox proof whether the chosen
 * SKU prints edge to edge (then the border is only where the proportions differ) or needs a bordered file.
 */
export const SIZING = "fitPrintArea";

/** Builds the POST /v4.0/Orders body. Throws (with a reason for /admin/orders) when anything needed is missing. */
export function buildOrderPayload(o: PayloadInput, cfg: PayloadConfig) {
  if (!o.items.length) throw new Error("The order has no prints.");
  const recipient = parseRecipient(o.shipName, o.shipAddress);
  const items = o.items.map((it) => {
    const { sku, attributes } = resolveSku(cfg.skus, it.size, it.frame);
    if (!it.assetUrl) throw new Error(`"${it.title}" has no original file to print.`);
    return {
      merchantReference: it.id,
      sku,
      copies: Math.max(1, Math.floor(it.quantity || 1)),
      sizing: SIZING,
      ...(attributes ? { attributes } : {}),
      assets: [{ printArea: "default", url: it.assetUrl }],
    };
  });
  return {
    merchantReference: o.number,
    idempotencyKey: cfg.idempotencyKey,
    shippingMethod: cfg.shippingMethod,
    recipient,
    items,
    ...(cfg.callbackUrl ? { callbackUrl: cfg.callbackUrl } : {}),
    // Unverified against live docs: "metadata" as a free-form object of strings.
    metadata: { artfinityOrderId: o.orderId, ...(o.reprintOf ? { reprintOf: o.reprintOf } : {}) },
    // Unverified against live docs: "packingSlip": { "url" } for a branded slip. Off unless PRODIGI_PACKING_SLIP=on.
    ...(cfg.packingSlipUrl ? { packingSlip: { url: cfg.packingSlipUrl } } : {}),
  };
}

export type OrderPayload = ReturnType<typeof buildOrderPayload>;

/** Our order id back from a Prodigi order: metadata first, else the idempotency key ("<orderId>" or "<orderId>-r<ms>"). */
export function ourOrderIdOf(order: ProdigiOrder | null | undefined): string | null {
  const meta = order?.metadata?.artfinityOrderId;
  const fromKey = typeof order?.idempotencyKey === "string" ? order.idempotencyKey.split("-r")[0] : null;
  const id = typeof meta === "string" ? meta : fromKey;
  return id && /^c[a-z0-9]{20,32}$/.test(id) ? id : null;
}

// ---------- Prodigi's order, as we read it ----------

// Unverified against live docs: stage names, the details keys and their values, and the shipment fields. These are
// the ones Prodigi API v4 documents as we know it; unknown values fall through to "received" and are shown as-is.
export type ProdigiStage = "Draft" | "AwaitingPayment" | "InProgress" | "Complete" | "Cancelled" | (string & {});
export type DetailState = "NotStarted" | "InProgress" | "Complete" | "Error" | (string & {});

export type ProdigiShipment = {
  id?: string;
  status?: string;
  dispatchDate?: string | null;
  carrier?: { name?: string | null; service?: string | null } | null;
  tracking?: { number?: string | null; url?: string | null } | null;
  items?: { itemId?: string }[];
};

export type ProdigiIssue = { objectId?: string; errorCode?: string; description?: string };

export type ProdigiOrder = {
  id: string;
  created?: string;
  lastUpdated?: string;
  merchantReference?: string;
  idempotencyKey?: string;
  status?: { stage?: ProdigiStage; issues?: ProdigiIssue[]; details?: Record<string, DetailState> };
  shipments?: ProdigiShipment[];
  metadata?: Record<string, unknown> | null;
};

export const validProdigiId = (id: unknown): id is string => typeof id === "string" && /^ord_[A-Za-z0-9_-]{1,60}$/.test(id);

/**
 * The Prodigi order id a callback is about. Callbacks are CloudEvents JSON: { specversion, type, source, id, time,
 * subject, data: { order } }. Unverified against live docs: whether the id is in data.order.id, subject, or both, so
 * every likely place is read. Only the id is used: the order itself is fetched again from the API.
 */
export function callbackOrderId(body: unknown): string | null {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, any>;
  const tries = [b.data?.order?.id, b.order?.id, b.data?.id, b.subject, typeof b.source === "string" ? b.source.split("/").pop() : null];
  return tries.find(validProdigiId) ?? null;
}

// ---------- Webhook token ----------

/** Constant-time compare of the ?token= in the callback URL. False when either side is empty. */
export function tokenMatches(given: string | null | undefined, secret: string | null | undefined): boolean {
  if (!given || !secret) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---------- Status mapping ----------

export type OurCarrier = "USPS" | "UPS" | "FedEx" | "Other";
export type ShipTracking = { carrier: OurCarrier; number: string; url: string | null };

export function mapCarrier(name: string | null | undefined): OurCarrier {
  const n = (name || "").toLowerCase();
  if (/\busps\b|postal service/.test(n)) return "USPS";
  if (/\bups\b|united parcel/.test(n)) return "UPS";
  if (/fedex|federal express/.test(n)) return "FedEx";
  return "Other";
}

/** A shipment's tracking in our shape, or null when it has no usable number. */
export function shipmentTracking(s: ProdigiShipment): ShipTracking | null {
  const number = (s.tracking?.number || "").trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{3,59}$/.test(number)) return null;
  const rawUrl = (s.tracking?.url || "").trim();
  const url = /^https:\/\/\S{4,300}$/.test(rawUrl) ? rawUrl : null;
  return { carrier: mapCarrier(s.carrier?.name), number, url };
}

/** Shipments with tracking, oldest first (stable, so the same one is always "the" tracking for the order). */
export function trackedShipments(order: ProdigiOrder): { shipment: ProdigiShipment; tracking: ShipTracking }[] {
  const out = (order.shipments ?? []).flatMap((s) => {
    const t = shipmentTracking(s);
    return t ? [{ shipment: s, tracking: t }] : [];
  });
  return out.sort((a, b) => (a.shipment.dispatchDate || "").localeCompare(b.shipment.dispatchDate || "") || (a.shipment.id || "").localeCompare(b.shipment.id || ""));
}

export type Phase = "draft" | "awaiting_payment" | "received" | "printing" | "shipping" | "complete" | "cancelled";

export const PHASE_LABEL: Record<Phase, string> = {
  draft: "Draft at Prodigi",
  awaiting_payment: "Waiting for payment at Prodigi",
  received: "Received by Prodigi",
  printing: "Printing",
  shipping: "Shipping",
  complete: "Shipped (complete)",
  cancelled: "Cancelled",
};

const started = (s: DetailState | undefined) => s === "InProgress" || s === "Complete";

export function phaseOf(order: ProdigiOrder): Phase {
  const stage = order.status?.stage;
  const d = order.status?.details ?? {};
  if (stage === "Cancelled") return "cancelled";
  if (stage === "Complete") return "complete";
  if (stage === "Draft") return "draft";
  if (stage === "AwaitingPayment") return "awaiting_payment";
  if (started(d.shipping) || (order.shipments ?? []).length) return "shipping";
  if (started(d.inProduction)) return "printing";
  return "received";
}

/** What we know about our order, for planning. */
export type OurOrder = { shippingStatus: string; trackingNumber: string | null; deliveredAt: Date | null; sentToPrinter: boolean };

export type SyncPlan = {
  phase: Phase;
  stage: string;
  /** Mark the order sent to the printer (it reached the lab). */
  markSent: boolean;
  /** Save this tracking and, if the order is still pending, mark it shipped and email the buyer (lib/shipping markShipped). */
  ship: ShipTracking | null;
  /** Prodigi's other tracked shipments (split parcels), shown on the admin page only. */
  extraTracking: ShipTracking[];
  /** Raise an alert. */
  problem: { key: "cancelled" | "problem"; severity: "urgent" | "normal"; text: string } | null;
  /** No problem any more: resolve the "problem" alert (the cancelled one stays until an admin acts). */
  clearProblem: boolean;
  /** Short line for the audit log and admin page. */
  summary: string;
  /** Changes when anything worth recording changes (so the audit log gets one row per change, not per callback). */
  signature: string;
  notes: string[];
};

/**
 * Turns Prodigi's current order into our transitions. Pure. Never moves an order backwards (shipped stays shipped,
 * delivered stays delivered), so a late or repeated callback can't undo anything, and applying the plan to the order
 * it produces gives an empty plan (idempotent).
 */
export function planSync(ours: OurOrder, order: ProdigiOrder): SyncPlan {
  const phase = phaseOf(order);
  const stage = order.status?.stage || "Unknown";
  const issues = (order.status?.issues ?? []).filter((i) => i && (i.description || i.errorCode));
  const errored = Object.entries(order.status?.details ?? {}).filter(([, v]) => v === "Error").map(([k]) => k);
  const tracked = trackedShipments(order);
  const notes: string[] = [];

  let ship: ShipTracking | null = null;
  const first = tracked[0]?.tracking ?? null;
  if (first && phase !== "cancelled" && !ours.deliveredAt && ours.shippingStatus !== "delivered") {
    if (ours.shippingStatus === "pending") ship = first;
    else if (!ours.trackingNumber) ship = first; // marked shipped by hand without a number: save Prodigi's
    else if (ours.trackingNumber.toLowerCase() !== first.number.toLowerCase()) notes.push(`Kept the tracking entered by hand (${ours.trackingNumber}); Prodigi has ${first.carrier} ${first.number}.`);
  }
  if ((phase === "complete" || phase === "shipping") && !first && ours.shippingStatus === "pending") {
    notes.push(phase === "complete" ? "Prodigi says it shipped but sent no tracking yet." : "Prodigi is shipping it; no tracking yet.");
  }

  let problem: SyncPlan["problem"] = null;
  if (phase === "cancelled") {
    problem = { key: "cancelled", severity: "urgent", text: "Prodigi cancelled it. Resend the work order or refund the buyer." };
  } else if (phase === "awaiting_payment") {
    problem = { key: "problem", severity: "urgent", text: "Prodigi is waiting for payment on our account. Check billing in the Prodigi dashboard." };
  } else if (issues.length || errored.length) {
    const what = issues.map((i) => i.description || i.errorCode).concat(errored.map((k) => `${k} failed`)).join("; ");
    problem = { key: "problem", severity: "normal", text: `Prodigi reports a problem: ${what}`.slice(0, 160) };
  }

  const extraTracking = tracked.slice(1).map((t) => t.tracking);
  const summary = [PHASE_LABEL[phase], first ? `${first.carrier} ${first.number}` : "", extraTracking.length ? `+${extraTracking.length} more parcel${extraTracking.length === 1 ? "" : "s"}` : "", problem ? problem.text : ""]
    .filter(Boolean)
    .join(" · ");
  const signature = JSON.stringify([stage, order.status?.details ?? {}, issues.map((i) => i.errorCode || i.description), tracked.map((t) => t.tracking.number)]);

  return {
    phase,
    stage,
    markSent: !ours.sentToPrinter && phase !== "cancelled" && phase !== "draft",
    ship,
    extraTracking,
    problem,
    clearProblem: !problem,
    summary,
    signature,
    notes,
  };
}

// ---------- API client ----------

const TIMEOUT_MS = 15_000;

function apiKey(env: Env): string {
  const k = env.PRODIGI_API_KEY?.trim();
  if (!k) throw new Error("PRODIGI_API_KEY isn't set.");
  return k;
}

/** One error line from a Prodigi error body (never includes the key: it isn't in the response). */
function errorText(status: number, body: any, raw: string): string {
  const outcome = typeof body?.outcome === "string" ? body.outcome : "";
  // Unverified against live docs: validation errors as { outcome: "ValidationFailed", failures: { "<field>": [{ code }] } }.
  const failures = body?.failures && typeof body.failures === "object"
    ? Object.entries(body.failures as Record<string, { code?: string }[]>).map(([f, v]) => `${f} ${Array.isArray(v) ? v.map((x) => x?.code).filter(Boolean).join("/") : ""}`.trim()).join(", ")
    : "";
  const msg = [outcome, failures].filter(Boolean).join(": ") || raw.replace(/\s+/g, " ").slice(0, 160);
  return `Prodigi ${status}${msg ? `: ${msg}` : ""}`;
}

async function call(path: string, init: { method: "GET" | "POST"; body?: unknown }, env: Env, fetchImpl: typeof fetch): Promise<any> {
  const res = await fetchImpl(`${prodigiBaseUrl(env)}${path}`, {
    method: init.method,
    headers: { "X-API-Key": apiKey(env), Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const raw = await res.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!res.ok) throw new Error(errorText(res.status, body, raw));
  return body;
}

export type CreateResult = { id: string; outcome: string; order: ProdigiOrder };

/**
 * POST /v4.0/Orders. Unverified against live docs: outcomes "Created", "CreatedWithIssues" and "AlreadyExists" (a
 * repeated idempotencyKey returns the first order). Any 2xx with an order id counts as sent.
 */
export async function createOrder(payload: OrderPayload, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<CreateResult> {
  const body = await call("/v4.0/Orders", { method: "POST", body: payload }, env, fetchImpl);
  const order = body?.order as ProdigiOrder | undefined;
  if (!order || !validProdigiId(order.id)) throw new Error(`Prodigi didn't return an order id${body?.outcome ? ` (${body.outcome})` : ""}.`);
  return { id: order.id, outcome: String(body.outcome || ""), order };
}

/** GET /v4.0/Orders/{id}: the order as Prodigi has it now. */
export async function getOrder(id: string, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<ProdigiOrder> {
  if (!validProdigiId(id)) throw new Error("Not a Prodigi order id.");
  const body = await call(`/v4.0/Orders/${encodeURIComponent(id)}`, { method: "GET" }, env, fetchImpl);
  const order = body?.order as ProdigiOrder | undefined;
  if (!order || order.id !== id) throw new Error("Prodigi returned a different order.");
  return order;
}
