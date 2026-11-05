// Certificates of authenticity for limited-edition prints. Server-only: signs links and reads orders.
//
// A certificate belongs to one paid OrderItem with an editionNumber. Its page, /certificate/<orderItemId>?t=<sig>,
// is signed like review and help links (HMAC of `cert:<id>`, same secret as lib/reviews.ts), so only the buyer,
// the artist and admin hold it. A line of 3 prints gets 3 certificates on that page, one per number.
//
// Certificate number: AF-<last 8 characters of the OrderItem id>-<print number>, e.g. AF-7SAG5VRD-12.
// The id's tail is random (cuid), so numbers can't be guessed, and /certificate/verify?n= finds the item
// by that tail. Verify shows the piece, the artist and the print number; never the buyer.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeSize } from "@/lib/sales";
import type { PrintSize } from "@/components/art/pricing";

const SECRET = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
/** Printed on the certificate (always the public domain, also in dev). */
export const VERIFY_HOST = "theartfinity.com";

// ---------- Signing ----------

export function signCert(itemId: string): string {
  return crypto.createHmac("sha256", SECRET).update(`cert:${itemId}`).digest("base64url").slice(0, 22);
}

export function verifyCert(itemId: string, sig: unknown): boolean {
  if (!SECRET || !itemId || typeof sig !== "string" || sig.length !== 22) return false;
  const want = Buffer.from(signCert(itemId));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const certPath = (itemId: string) => `/certificate/${itemId}?t=${signCert(itemId)}`;
export const certUrl = (itemId: string) => `${APP_URL}${certPath(itemId)}`;

// ---------- Numbers ----------

const tailOf = (itemId: string) => itemId.slice(-8).toUpperCase();
export const certNumber = (itemId: string, printNo: number) => `AF-${tailOf(itemId)}-${printNo}`;
export const verifyPath = (n: string) => `/certificate/verify?n=${encodeURIComponent(n)}`;

export function parseCertNumber(raw: unknown): { tail: string; printNo: number } | null {
  const m = /^\s*(?:AF-?)?([A-Z0-9]{8})-?(\d{1,3})\s*$/i.exec(typeof raw === "string" ? raw : "");
  if (!m) return null;
  return { tail: m[1].toLowerCase(), printNo: parseInt(m[2], 10) };
}

// ---------- Reads ----------

const SIZE_KEY: Record<string, PrintSize> = { S: "small", M: "medium", L: "large", XL: "xl" };

const select = {
  id: true, title: true, size: true, quantity: true, editionNumber: true, imageUrl: true, artistName: true,
  order: { select: { createdAt: true, paymentStatus: true } },
  artwork: { select: { title: true, imageUrl: true, slug: true, editionSize: true, artist: { select: { name: true, artist_name: true, slug: true } } } },
} as const;

/** Paid edition lines only. Free replacements (reprints) keep the original's certificate, so they don't get one. */
const issued = { editionNumber: { not: null }, order: { paymentStatus: "paid" } } as const;

export type Certificate = {
  itemId: string;
  number: string;
  printNo: number;
  editionSize: number;
  title: string;
  artist: string;
  artistHandle: string | null;
  slug: string | null;
  imageUrl: string | null;
  size: PrintSize;
  orderDate: Date;
};

type Row = NonNullable<Awaited<ReturnType<typeof loadRow>>>;
const loadRow = (id: string) => prisma.orderItem.findFirst({ where: { id, ...issued }, select });

function shape(it: Row): Certificate[] {
  const editionSize = it.artwork?.editionSize;
  if (!it.editionNumber || !editionSize) return [];
  const q = Math.max(1, it.quantity ?? 1);
  const base = {
    itemId: it.id,
    editionSize,
    title: it.artwork?.title || it.title || "Untitled",
    artist: it.artwork?.artist.artist_name || it.artwork?.artist.name || it.artistName || "",
    artistHandle: it.artwork?.artist.slug ?? null,
    slug: it.artwork?.slug ?? null,
    imageUrl: it.artwork?.imageUrl || it.imageUrl,
    size: SIZE_KEY[normalizeSize(it.size)] ?? "medium",
    orderDate: it.order.createdAt,
  };
  return Array.from({ length: q }, (_, k) => {
    const printNo = it.editionNumber! + k;
    return { ...base, printNo, number: certNumber(it.id, printNo) };
  });
}

/** Every certificate on an order line (one per print), or [] when it isn't a paid edition line. */
export async function certificatesFor(itemId: string): Promise<Certificate[]> {
  const it = await loadRow(itemId);
  return it ? shape(it) : [];
}

/** The certificate with this number, or null when no such print was sold. */
export async function findCertificate(raw: unknown): Promise<Certificate | null> {
  const p = parseCertNumber(raw);
  if (!p) return null;
  const rows = await prisma.orderItem.findMany({ where: { id: { endsWith: p.tail }, ...issued }, select, take: 3 });
  for (const r of rows) {
    const c = shape(r).find((x) => x.printNo === p.printNo);
    if (c) return c;
  }
  return null;
}

/** Which of these order items have a certificate, as id → signed path. For receipts and order views. */
export async function certPathsFor(itemIds: string[]): Promise<Map<string, string>> {
  if (!itemIds.length) return new Map();
  const rows = await prisma.orderItem.findMany({
    where: { id: { in: itemIds }, ...issued, artwork: { editionSize: { not: null } } },
    select: { id: true },
  });
  return new Map(rows.map((r) => [r.id, certPath(r.id)]));
}

/** Absolute certificate links for an order's edition lines, for the shipped email. */
export async function certLinksFor(orderId: string): Promise<{ title: string; url: string }[]> {
  const rows = await prisma.orderItem.findMany({
    where: { orderId, ...issued, artwork: { editionSize: { not: null } } },
    select: { id: true, title: true, artwork: { select: { title: true } } },
  });
  return rows.map((r) => ({ title: r.artwork?.title || r.title || "Your print", url: certUrl(r.id) }));
}

/** Plain lines for the artist-worded shipped email. */
export const certLines = (links: { title: string; url: string }[]) =>
  links.map((l) => `Certificate of authenticity for ${l.title}: ${l.url}`).join("\n");
