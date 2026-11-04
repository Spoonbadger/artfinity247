// Server-only data for the Studio customers pages and /api/studio/customers.
import { prisma } from "@/lib/prisma";
import { toPrintSize, type StudioArtist } from "../_lib/data";
import type { PrintSize } from "@/lib/revenue";

export type OrderStage = "paid" | "printing" | "shipped" | "delivered";

export const STAGES: { key: OrderStage; label: string; dab: string }[] = [
  { key: "paid", label: "Paid", dab: "#ffd43b" },
  { key: "printing", label: "At the printer", dab: "#e8743b" },
  { key: "shipped", label: "Shipped", dab: "#2b37f0" },
  { key: "delivered", label: "Delivered", dab: "#15161b" },
];

export function stageOf(o: { shippingStatus: string; sentToPrinter: boolean }): OrderStage {
  if (o.shippingStatus === "delivered") return "delivered";
  if (o.shippingStatus === "shipped") return "shipped";
  return o.sentToPrinter ? "printing" : "paid";
}

/** City and state only from "1 Main St, Asheville, NC 28801, US". Never the street. */
export function cityOf(address: string | null | undefined) {
  const parts = String(address || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    // [..., city, "ST 12345", country?]
    const hasCountry = parts.length >= 4 || /^[A-Z]{2,3}$/.test(parts[parts.length - 1]) && !/\d/.test(parts[parts.length - 1]) && parts.length > 3;
    const stateIdx = hasCountry ? parts.length - 2 : parts.length - 1;
    const state = parts[stateIdx].replace(/\s*\d[\d-]*$/, "").trim();
    const city = parts[stateIdx - 1];
    if (city && !/^\d/.test(city)) return state ? `${city}, ${state}` : city;
  }
  return "";
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
      order = { id: o.id, date: o.createdAt, stage: stageOf(o), items: [], prints: 0, spentCents: 0 };
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

export const customerHref = (email: string) => `/studio/customers/${encodeURIComponent(email)}`;

export type ArtistLite = Pick<StudioArtist, "id">;
