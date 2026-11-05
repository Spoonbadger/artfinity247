// Small, pure helpers behind the smart form fields (components/forms/*): formatting as you type, inline checks
// with a fix, password strength, social handle parsing, and "remember my last choice".
// Safe to import from client and server.

/* ---------------- Phone (US) ---------------- */

/** Digits only, without a leading US 1, at most 10. */
export function phoneDigits(s: string) {
  let d = (s || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.slice(0, 10);
}

/** "2125550123" → "(212) 555-0123", formatting partial input as it grows. Keeps a leading "+" for non-US numbers. */
export function formatPhone(s: string) {
  const raw = (s || "").trim();
  if (raw.startsWith("+") && !raw.startsWith("+1")) return raw.replace(/[^\d+\s()-]/g, "").slice(0, 20);
  const d = phoneDigits(raw);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/* ---------------- ZIP ---------------- */

/** Keep digits and one hyphen: "112110000" → "11211-0000". */
export function formatZip(s: string) {
  const d = (s || "").replace(/\D/g, "").slice(0, 9);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/* ---------------- Money ---------------- */

/** Clean what someone typed into a dollar amount string: digits and at most 2 decimals ("$1,2.345" → "12.34"). */
export function cleanMoney(s: string, max = 99999) {
  let v = (s || "").replace(/[^0-9.]/g, "");
  const dot = v.indexOf(".");
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  if (v.startsWith(".")) v = "0" + v;
  v = v.replace(/^0+(?=\d)/, "");
  const n = parseFloat(v);
  if (Number.isFinite(n) && n > max) return String(max);
  return v;
}

/** "1234.5" → "1,234.50" for display after blur. Empty stays empty. */
export function formatMoney(s: string | number) {
  const n = typeof s === "number" ? s : parseFloat(String(s).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/* ---------------- Inline checks ---------------- */

/** A check returns null when fine, or one line saying what's wrong and how to fix it. */
export type Check = (value: string) => string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMMON_DOMAINS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmail.co": "gmail.com", "gmail.con": "gmail.com",
  "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com", "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "iclod.com": "icloud.com", "icloud.co": "icloud.com", "outlok.com": "outlook.com", "outlook.co": "outlook.com",
};

/** A likely typo fix for an email's domain ("maya@gmial.com" → "maya@gmail.com"), or null. */
export function emailTypo(email: string): string | null {
  const m = email.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) return null;
  const fix = COMMON_DOMAINS[m[2]];
  return fix ? `${m[1]}@${fix}` : null;
}

export const checks = {
  required: (what: string): Check => (v) => (v.trim() ? null : `Add ${what}.`),
  email: ((v) => {
    const s = v.trim();
    if (!s) return "Add your email. We send receipts and updates there.";
    if (!s.includes("@")) return "Missing the @. It looks like name@example.com.";
    if (!EMAIL_RE.test(s)) return "That email looks incomplete. It looks like name@example.com.";
    const typo = emailTypo(s);
    if (typo) return `Did you mean ${typo}?`;
    return null;
  }) as Check,
  phone: ((v) => {
    if (!v.trim()) return null;
    if (v.trim().startsWith("+") && !v.trim().startsWith("+1")) return v.replace(/\D/g, "").length >= 8 ? null : "That number looks short. Include the country code.";
    const d = phoneDigits(v);
    return d.length === 10 ? null : `That's ${d.length} digits. US numbers have 10, like (212) 555-0123.`;
  }) as Check,
  zip: ((v) => {
    if (!v.trim()) return "Add the ZIP code.";
    return /^\d{5}(-\d{4})?$/.test(v.trim()) ? null : "ZIP codes are 5 digits, like 11211.";
  }) as Check,
  url: ((v) => {
    const s = v.trim();
    if (!s) return null;
    if (/\s/.test(s)) return "Links can't have spaces. Paste the address from your browser.";
    if (!/\.[a-z]{2,}/i.test(s.replace(/^https?:\/\//i, "").split("/")[0])) return "That link needs a domain, like yourname.com.";
    return null;
  }) as Check,
  newPassword: ((v) => (v.length >= 8 ? null : v.length ? `Add ${8 - v.length} more character${8 - v.length === 1 ? "" : "s"}. 8 is the minimum.` : "Pick a password, 8 or more characters.")) as Check,
};

/* ---------------- Password strength ---------------- */

export type Strength = { score: 0 | 1 | 2 | 3; label: string; tip: string | null };

const COMMON_PW = /^(password|passw0rd|12345678|123456789|1234567890|qwerty|qwertyuiop|iloveyou|letmein|welcome|artfinity|abc12345|11111111|00000000)/i;

/** A quick, honest strength hint: length matters most. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", tip: null };
  if (pw.length < 8) return { score: 0, label: "Too short", tip: "Use 8 or more characters." };
  if (COMMON_PW.test(pw) || /^(.)\1+$/.test(pw)) return { score: 0, label: "Too common", tip: "Easy to guess. Try a few unrelated words." };
  let kinds = 0;
  if (/[a-z]/.test(pw)) kinds++;
  if (/[A-Z]/.test(pw)) kinds++;
  if (/\d/.test(pw)) kinds++;
  if (/[^A-Za-z0-9]/.test(pw)) kinds++;
  const pts = (pw.length >= 12 ? 2 : pw.length >= 10 ? 1 : 0) + (kinds >= 3 ? 1 : 0) + (pw.length >= 16 ? 1 : 0);
  if (pts >= 3) return { score: 3, label: "Strong", tip: null };
  if (pts >= 1) return { score: 2, label: "Good", tip: pw.length < 12 ? "A few more characters makes it strong." : null };
  return { score: 1, label: "Okay", tip: "Longer is stronger. Try 12 or more." };
}

/* ---------------- Social handles ---------------- */

export type SocialPlatform = "instagram" | "tiktok" | "x" | "threads" | "youtube" | "facebook" | "pinterest";

const HOSTS: Record<SocialPlatform, RegExp> = {
  instagram: /(^|\.)(instagram\.com|instagr\.am)$/,
  tiktok: /(^|\.)tiktok\.com$/,
  x: /(^|\.)(x\.com|twitter\.com)$/,
  threads: /(^|\.)threads\.(net|com)$/,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/,
  facebook: /(^|\.)(facebook\.com|fb\.com)$/,
  pinterest: /(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/,
};

export const SOCIAL_URL: Record<SocialPlatform, (h: string) => string> = {
  instagram: (h) => `https://instagram.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h}`,
  x: (h) => `https://x.com/${h}`,
  threads: (h) => `https://threads.net/@${h}`,
  youtube: (h) => `https://youtube.com/@${h}`,
  facebook: (h) => `https://facebook.com/${h}`,
  pinterest: (h) => `https://pinterest.com/${h}`,
};

const HANDLE_OK: Record<SocialPlatform, RegExp> = {
  instagram: /^[a-z0-9._]{1,30}$/i,
  tiktok: /^[a-z0-9._]{2,24}$/i,
  x: /^[a-z0-9_]{1,15}$/i,
  threads: /^[a-z0-9._]{1,30}$/i,
  youtube: /^[a-z0-9._-]{3,30}$/i,
  facebook: /^[a-z0-9.]{5,50}$/i,
  pinterest: /^[a-z0-9_]{3,30}$/i,
};

const NOT_PROFILES = new Set(["p", "reel", "reels", "tv", "stories", "explore", "video", "watch", "status", "share", "channel", "c", "user", "hashtag", "tag", "pin", "accounts"]);

/**
 * Pull the handle out of whatever was pasted: "@maya.paints", "maya.paints",
 * "https://www.instagram.com/maya.paints/?hl=en", "instagram.com/maya.paints". Returns the bare handle, or an error.
 */
export function parseSocialHandle(platform: SocialPlatform, input: string): { handle: string; url: string } | { error: string } | null {
  let s = (input || "").trim();
  if (!s) return null;
  let path: string | null = null;
  const looksUrl = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(s);
  if (looksUrl) {
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
      const host = u.hostname.toLowerCase().replace(/^(www|m|vm)\./, "");
      if (!HOSTS[platform].test(host)) return { error: `That's not a ${PLATFORM_LABEL[platform]} link. Paste your profile link or just @yourname.` };
      const parts = u.pathname.split("/").filter(Boolean);
      if (!parts.length) return { error: `That's the ${PLATFORM_LABEL[platform]} home page. Add your name after the slash.` };
      if (NOT_PROFILES.has(parts[0].toLowerCase())) return { error: `That's a post link, not your profile. Tap your name on ${PLATFORM_LABEL[platform]} and copy that link.` };
      path = decodeURIComponent(parts[0]);
    } catch {
      return { error: "That link doesn't look right. Paste it again or type @yourname." };
    }
  }
  s = (path ?? s).replace(/^@+/, "").replace(/\/+$/, "");
  if (!HANDLE_OK[platform].test(s)) {
    if (/\s/.test(s)) return { error: "Handles don't have spaces." };
    return { error: `That doesn't look like a ${PLATFORM_LABEL[platform]} handle. Letters, numbers, dots and underscores.` };
  }
  return { handle: s, url: SOCIAL_URL[platform](s) };
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram", tiktok: "TikTok", x: "X", threads: "Threads", youtube: "YouTube", facebook: "Facebook", pinterest: "Pinterest",
};

/* ---------------- Remember my last choice ---------------- */

const PREFIX = "af:last:";

/** Read a remembered choice. Private windows and blocked storage just return the fallback. */
export function recall<T = string>(key: string, fallback: T | null = null): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/** Remember a choice for next time. Never throws. */
export function remember(key: string, value: unknown) {
  try {
    if (value == null || value === "") window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage blocked: fine, we just won't remember
  }
}
