// The short code an artist puts on their website to prove it's theirs (server only). Same code every time for the
// same artist, so it can sit on their site for good; it means nothing without our secret.
import crypto from "node:crypto";

const ABC = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function verifyCode(artistId: string, secret = process.env.JWT_SECRET || process.env.SCAN_SIGNING_SECRET || "dev"): string {
  const hex = crypto.createHmac("sha256", secret).update(`artfinity-verify:${artistId}`).digest("hex");
  let out = "";
  for (let i = 0; i < 8; i++) out += ABC[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % ABC.length];
  return `artfinity-verify-${out}`;
}

/** Hosts an Artfinity page link can use: theartfinity.com and this deployment's own host. */
export function artfinityHosts(): string[] {
  const out = ["theartfinity.com"];
  try {
    const h = new URL(process.env.NEXT_PUBLIC_APP_URL || "").hostname;
    if (h) out.push(h);
  } catch {
    // not set
  }
  return out;
}
