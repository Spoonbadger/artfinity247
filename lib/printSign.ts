// Signs the print sizes POST /api/uploads measured, so the artwork routes can trust them without re-measuring.
// Server-only: uses the signing secret.
import crypto from "crypto";
import type { PrintSize } from "@/components/art/pricing";

const SECRET = process.env.JWT_SECRET || "";

export function signPrintable(url: string, printable: PrintSize[]): string {
  return crypto.createHmac("sha256", SECRET).update(`print|${url}|${printable.join(",")}`).digest("base64url").slice(0, 16);
}

export function verifyPrintable(url: string, printable: PrintSize[], sig: unknown): boolean {
  if (!SECRET || typeof sig !== "string" || sig.length !== 16) return false;
  const want = Buffer.from(signPrintable(url, printable));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
