// Page views on artist pages (server only). The ViewBeacon posts to /api/track; this file classifies
// where the visit came from. No personal data: referrer host only, coarse device, random visitor id (af_vid).
import { prisma } from "@/lib/prisma";
import { deviceFrom } from "@/lib/shortlinks";
import { normalizeCode } from "@/lib/shortcode";

/** One view per visitor and path in this window, so refreshes don't inflate counts. */
export const VIEW_WINDOW_MS = 30 * 60 * 1000;

export const SOURCE_LABEL: Record<string, string> = {
  qr: "QR codes",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  pinterest: "Pinterest",
  email: "Email",
  search: "Search",
  share: "Shared links",
  embed: "Website widget",
  direct: "Direct",
};
export const sourceLabel = (s: string) => SOURCE_LABEL[s] || s;

/** "https://www.Example.com/a?b" → "example.com". null for junk. */
export function refHost(ref: unknown): string | null {
  if (typeof ref !== "string" || !ref || ref.length > 2000) return null;
  try {
    const u = new URL(ref);
    // Android apps send android-app://com.instagram.android
    const h = (u.protocol === "android-app:" ? u.host || u.pathname.replace(/^\/+/, "").split("/")[0] : u.host).toLowerCase();
    return h.replace(/^www\./, "").replace(/:\d+$/, "").slice(0, 100) || null;
  } catch {
    return null;
  }
}

const has = (h: string, name: string) => h === name || h.endsWith("." + name);

/** Source from a referrer host, or the host itself for other sites. */
export function sourceFromHost(h: string): string {
  if (/(^|\.)(instagram\.com|instagr\.am)$/.test(h) || h.includes("com.instagram")) return "instagram";
  if (has(h, "tiktok.com") || h.includes("musically") || h.includes("com.zhiliaoapp")) return "tiktok";
  if (has(h, "facebook.com") || has(h, "fb.com") || has(h, "fb.me") || h.includes("com.facebook")) return "facebook";
  if (/(^|\.)pinterest\.[a-z.]+$/.test(h) || h === "pin.it" || h.includes("com.pinterest")) return "pinterest";
  // Mail before search: mail.google.com is Gmail, not Google search.
  if (h === "mail.google.com" || h.includes("com.google.android.gm") || /(^|\.)(mail|webmail)\./.test(h) || has(h, "outlook.live.com") || has(h, "outlook.office.com") || has(h, "outlook.office365.com") || has(h, "proton.me") || has(h, "fastmail.com") || has(h, "substack.com") || has(h, "mailchimp.com") || has(h, "list-manage.com") || has(h, "beehiiv.com") || has(h, "convertkit.com") || has(h, "kit.com"))
    return "email";
  if (/(^|\.)google\.[a-z.]+$/.test(h) || h.includes("googlequicksearchbox") || has(h, "bing.com") || has(h, "duckduckgo.com") || has(h, "search.yahoo.com") || has(h, "ecosia.org") || has(h, "search.brave.com") || /(^|\.)yandex\.[a-z]+$/.test(h) || has(h, "baidu.com") || has(h, "startpage.com"))
    return "search";
  return h;
}

/** utm_source as written by people ("IG", "newsletter", "fb") → our source names. */
export function sourceFromUtm(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  if (!s) return "direct";
  if (/^(ig|insta|instagram)/.test(s)) return "instagram";
  if (/^(tt|tiktok)/.test(s)) return "tiktok";
  if (/^(fb|facebook|meta)/.test(s)) return "facebook";
  if (/^(pin|pinterest)/.test(s)) return "pinterest";
  if (/(mail|newsletter|substack|klaviyo|mailchimp)/.test(s)) return "email";
  if (/^(google|bing|duckduckgo|search)/.test(s)) return "search";
  if (/^(qr|scan)/.test(s)) return "qr";
  return s.includes(".") ? sourceFromHost(s.replace(/^www\./, "")) : s;
}

/** The share kit tags its links ?src=share-<channel> (components/share/shareData.ts artLink). */
export function sourceFromSrc(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const ch = s.match(/^share-(instagram|tiktok|facebook|pinterest|email)/)?.[1];
  if (ch) return ch; // share-email and share-email-signature
  if (s === "embed") return "embed";
  if (s.startsWith("share-")) return "share"; // native share sheet, captions, story images, videos
  return null;
}

export type Touch = { ref?: unknown; utm?: unknown; src?: unknown; c?: unknown; qr?: unknown };

/** Where a visit came from: QR first, then utm_source, the share kit's ?src=, then the referrer. */
export function classify(t: Touch, ownHosts: string[]): { source: string; referrer: string | null } {
  let host = refHost(t.ref);
  if (host && ownHosts.includes(host)) host = null; // moving around our own site
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 100) : "");
  if (normalizeCode(str(t.c)) || t.qr === 1 || t.qr === true) return { source: "qr", referrer: host };
  if (str(t.utm)) return { source: sourceFromUtm(str(t.utm)), referrer: host };
  const fromSrc = str(t.src) ? sourceFromSrc(str(t.src)) : null;
  if (fromSrc) return { source: fromSrc, referrer: host };
  return { source: host ? sourceFromHost(host) : "direct", referrer: host };
}

/** mobile | tablet | desktop, from the same parser the scan tracker uses. */
export function viewDevice(ua: string | null | undefined) {
  const d = deviceFrom(ua);
  return d === "phone" ? "mobile" : d;
}

/** Views across an artist's pages in [from, to). */
export function countArtistViews(artistId: string, from: Date, to: Date) {
  return prisma.pageView.count({ where: { artistId, createdAt: { gte: from, lt: to } } });
}
