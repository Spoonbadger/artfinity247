// Server-only data for the Studio customers pages and /api/studio/customers.
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { toPrintSize } from "../_lib/data";
import type { PrintSize } from "@/lib/revenue";
import type { Stage } from "@/components/crm/format";
import { approvedReprintReasons } from "@/lib/reprints";
import { artistReprintLine } from "@/lib/reprintFormat";

export type OrderStage = Stage;

export function stageOf(o: { shippingStatus: string; sentToPrinter: boolean }): OrderStage {
  if (o.shippingStatus === "delivered") return "delivered";
  if (o.shippingStatus === "shipped") return "shipped";
  return o.sentToPrinter ? "printing" : "paid";
}

/** City and state only from "1 Main St, Brooklyn, NY 11216, US". Never the street. */
export function cityOf(address: string | null | undefined) {
  let p = String(address || "").split(",").map((x) => x.trim()).filter(Boolean);
  // Drop a trailing country after "NY 11216".
  if (p.length >= 3 && !/\d/.test(p[p.length - 1]) && /\d/.test(p[p.length - 2])) p = p.slice(0, -1);
  if (p.length < 2) return "";
  const state = p[p.length - 1].replace(/\s*\d[\d\s-]*$/, "").trim();
  const city = p[p.length - 2];
  if (/^\d/.test(city)) return /^\d/.test(state) ? "" : state;
  return state ? `${city}, ${state}` : city;
}

/** m•••@example.com */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, 1)}•••@${domain}`;
}

export type CustomerOrderItem = {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string | null;
  size: PrintSize;
  framed: boolean;
  quantity: number;
  priceCents: number;
};

export type CustomerOrder = {
  id: string;
  date: Date;
  stage: OrderStage;
  items: CustomerOrderItem[];
  prints: number;
  spentCents: number;
  /** Set when Artfinity reprinted part of this order for free (lib/reprints.ts). */
  reprint: string | null;
};

export type Customer = {
  email: string;
  name: string;
  city: string;
  first: Date;
  last: Date;
  orders: CustomerOrder[];
  prints: number;
  spentCents: number;
  stage: OrderStage;
  repeat: boolean;
};

/** Everyone who bought this artist's work: paid retail orders, grouped by order email, newest first. */
export async function getCustomers(artistId: string, onlyEmail?: string): Promise<Customer[]> {
  const items = await prisma.orderItem.findMany({
    where: {
      artwork: { artistId },
      order: {
        paymentStatus: "paid",
        kind: { not: "bulk" },
        ...(onlyEmail ? { email: { equals: onlyEmail, mode: "insensitive" as const } } : {}),
      },
    },
    select: {
      id: true, title: true, slug: true, size: true, frameChosen: true, quantity: true, unitPrice: true, lineTotal: true, imageUrl: true,
      artwork: { select: { title: true, slug: true, imageUrl: true } },
      order: { select: { id: true, email: true, createdAt: true, shippingName: true, shippingAddress: true, shippingStatus: true, sentToPrinter: true } },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  const byEmail = new Map<string, Customer>();
  const orderMap = new Map<string, CustomerOrder>();
  for (const it of items) {
    const o = it.order;
    const key = o.email.trim().toLowerCase();
    if (!key) continue;
    const quantity = it.quantity ?? 1;
    const priceCents = it.lineTotal ?? (it.unitPrice ?? 0) * quantity;

    let c = byEmail.get(key);
    if (!c) {
      // Items are newest first, so the first row holds the latest name, city and status.
      c = { email: key, name: o.shippingName?.trim() || key.split("@")[0], city: cityOf(o.shippingAddress), first: o.createdAt, last: o.createdAt, orders: [], prints: 0, spentCents: 0, stage: stageOf(o), repeat: false };
      byEmail.set(key, c);
    }
    let order = orderMap.get(o.id);
    if (!order) {
      order = { id: o.id, date: o.createdAt, stage: stageOf(o), items: [], prints: 0, spentCents: 0, reprint: null };
      orderMap.set(o.id, order);
      c.orders.push(order);
      if (o.createdAt < c.first) c.first = o.createdAt;
    }
    order.items.push({
      id: it.id,
      title: it.artwork?.title || it.title || "Untitled",
      slug: it.artwork?.slug || it.slug,
      imageUrl: it.artwork?.imageUrl || it.imageUrl,
      size: toPrintSize(it.size),
      framed: it.frameChosen,
      quantity,
      priceCents,
    });
    order.prints += quantity;
    order.spentCents += priceCents;
    c.prints += quantity;
    c.spentCents += priceCents;
  }
  const list = Array.from(byEmail.values());
  for (const c of list) c.repeat = c.orders.length >= 2;
  // Only the single-customer page shows reprint notes; skip the lookup for the full list.
  if (onlyEmail) {
    const reprints = await approvedReprintReasons(Array.from(orderMap.keys()));
    for (const [id, reason] of Array.from(reprints)) {
      const o = orderMap.get(id);
      if (o) o.reprint = artistReprintLine(reason);
    }
  }
  return list;
}

export async function getCustomer(artistId: string, email: string) {
  const [c] = await getCustomers(artistId, email.trim().toLowerCase());
  return c || null;
}

export async function getMessages(artistId: string, email: string) {
  return prisma.message.findMany({
    where: { artistId, email: email.trim().toLowerCase() },
    orderBy: { createdAt: "asc" },
    select: { id: true, direction: true, subject: true, body: true, sentAt: true, createdAt: true, orderId: true },
  });
}

/** Safe decode of the [email] route segment. */
export function emailFromParam(param: string) {
  let e = param;
  try { e = decodeURIComponent(param); } catch { /* keep raw */ }
  e = e.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+$/.test(e) ? e : null;
}

/**
 * Opaque, stable id for a buyer in URLs (so emails stay out of links, history and logs): a keyed hash of the
 * lower-cased email, 16 url-safe chars. The detail page maps it back by scanning the artist's own buyers.
 */
export function customerId(email: string) {
  return createHmac("sha256", process.env.JWT_SECRET || "artfinity-dev").update(`customer|${email.trim().toLowerCase()}`).digest("base64url").slice(0, 16);
}

export const customerHref = (email: string) => `/studio/customers/${customerId(email)}`;

/** The route segment is an opaque id (current links) or an email (older links, which redirect to the id). */
export async function customerFromParam(artistId: string, param: string): Promise<{ email: string; legacy: boolean } | null> {
  const asEmail = emailFromParam(param);
  if (asEmail) return { email: asEmail, legacy: true };
  if (!/^[\w-]{16}$/.test(param)) return null;
  const emails = await prisma.order.findMany({
    where: { paymentStatus: "paid", kind: { not: "bulk" }, items: { some: { artwork: { artistId } } } },
    select: { email: true },
    distinct: ["email"],
  });
  const hit = emails.find((o) => customerId(o.email) === param);
  return hit ? { email: hit.email.trim().toLowerCase(), legacy: false } : null;
}

