// Artist-written automated emails: defaults, variables and rendering.
// Pure module (no database), so the Studio editor can render live previews in the browser.
// Database lookups and sending live in lib/artistEmails.server.ts.

export const EMAIL_KINDS = ["receipt", "shipped", "delivered", "thank_you"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const isEmailKind = (k: unknown): k is EmailKind => typeof k === "string" && (EMAIL_KINDS as readonly string[]).includes(k);

export const EMAIL_KIND_LABEL: Record<EmailKind, string> = {
  receipt: "Receipt",
  shipped: "Shipped",
  delivered: "Delivered",
  thank_you: "Thank-you",
};

/** When each email goes out, in a few words. */
export const EMAIL_KIND_WHEN: Record<EmailKind, string> = {
  receipt: "Right after they buy",
  shipped: "When the print ships",
  delivered: "When it arrives",
  thank_you: "7 days after delivery",
};

export const EMAIL_VARIABLES = ["buyer_first_name", "artwork_title", "artist_name", "order_link", "size"] as const;
export type EmailVariable = (typeof EMAIL_VARIABLES)[number];
export type EmailVars = Partial<Record<EmailVariable, string>>;

export const EMAIL_LIMITS = { subject: 150, body: 4000 };

/** Artfinity's wording, used whenever an artist has no template (or turned theirs off). */
export const DEFAULT_TEMPLATES: Record<EmailKind, { subject: string; body: string }> = {
  receipt: {
    subject: "Your print of {artwork_title} is ordered",
    body:
      "Hi {buyer_first_name},\n\n" +
      "Thank you for buying {artwork_title} ({size}). We print it to order, then send it your way.\n\n" +
      "Your order: {order_link}\n\n" +
      "{artist_name} gets paid for every print. Thank you for supporting a real artist.",
  },
  shipped: {
    subject: "{artwork_title} is on its way",
    body:
      "Hi {buyer_first_name},\n\n" +
      "Your print of {artwork_title} ({size}) just shipped. It should reach you in a few days.\n\n" +
      "Your order: {order_link}",
  },
  delivered: {
    subject: "{artwork_title} has arrived",
    body:
      "Hi {buyer_first_name},\n\n" +
      "Your print of {artwork_title} was delivered. We hope it looks great on your wall.\n\n" +
      "Something not right? Reply to this email and we will make it right.",
  },
  thank_you: {
    subject: "A thank-you from {artist_name}",
    body:
      "Hi {buyer_first_name},\n\n" +
      "It has been a week since {artwork_title} arrived, and I wanted to say thank you. " +
      "Knowing my work hangs in your home means a lot.\n\n" +
      "Warmly,\n{artist_name}",
  },
};

/** Replace {variable} placeholders. Unknown placeholders are left as they are. */
export function fillVariables(text: string, vars: EmailVars) {
  return text.replace(/\{([a-z_]+)\}/g, (m, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    return v === undefined ? m : v;
  });
}

export type TemplateLike = { subject: string; body: string; enabled: boolean } | null | undefined;

export type RenderedEmail = { subject: string; body: string; text: string; html: string; custom: boolean };

/**
 * Render an artist's template, or Artfinity's default when the artist has none or it is off.
 * `custom` tells the caller whose wording was used.
 */
export function renderArtistEmail(kind: EmailKind, template: TemplateLike, vars: EmailVars, opts: { footer?: string } = {}): RenderedEmail {
  const custom = !!(template && template.enabled && template.subject.trim() && template.body.trim());
  const src = custom ? template! : DEFAULT_TEMPLATES[kind];
  const subject = fillVariables(src.subject, vars).replace(/\s+/g, " ").trim();
  const body = fillVariables(src.body, vars).trim();
  const footer = opts.footer ?? "Sent with Artfinity. Every wall is a shop.";
  return { subject, body, text: `${body}\n\n--\n${footer}`, html: emailHtml(body, footer), custom };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Turns plain text into simple, safe email HTML: paragraphs, line breaks, clickable links. */
export function emailHtml(body: string, footer = "Sent with Artfinity. Every wall is a shop.") {
  const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#2b37f0">${u}</a>`);
  const paras = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${linkify(esc(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return (
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#15161b;max-width:560px;margin:0 auto;padding:24px">` +
    paras +
    `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e6e3dc;font-size:13px;color:#5b5d66">${esc(footer)}</p>` +
    `</div>`
  );
}

/** "Buyer 12" -> "Buyer", "ada lovelace" -> "Ada". */
export function firstNameOf(name: string | null | undefined, fallback = "there") {
  const f = String(name || "").trim().split(/\s+/)[0] || "";
  return f ? f[0].toUpperCase() + f.slice(1) : fallback;
}

/** "A", "A and B", "A, B and 2 more". */
export function joinTitles(titles: string[]) {
  const t = Array.from(new Set(titles.filter(Boolean)));
  if (t.length === 0) return "your print";
  if (t.length === 1) return t[0];
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  return `${t[0]}, ${t[1]} and ${t.length - 2} more`;
}

const SIZE_WORDS: Record<string, string> = { S: "Small, 5 × 7 in", M: "Medium, 8 × 12 in", L: "Large, 11 × 17 in", XL: "XL, 18 × 24 in" };

/** OrderItem.size ("S" | "M" | "L" | "XL", or older "small") as words. */
export function sizeWords(size: string | null | undefined) {
  const s = String(size || "").trim().toLowerCase();
  const key = s === "s" || s === "small" ? "S" : s === "l" || s === "large" ? "L" : s === "xl" || s === "x-large" ? "XL" : s ? "M" : "";
  return key ? SIZE_WORDS[key] : "";
}

/** Strips the [parcel] tag the Studio stores on thank-you notes meant for the box. */
export const PARCEL_TAG = "[parcel]";
export function splitParcelTag(subject: string | null | undefined) {
  const s = String(subject || "");
  const parcel = s.startsWith(PARCEL_TAG);
  return { parcel, subject: parcel ? s.slice(PARCEL_TAG.length).trim() : s };
}
