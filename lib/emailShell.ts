// The string version of Artfinity's email frame (emails/_layout.tsx is the React one): logo, a white card on the
// blush wall, a quiet footer. For emails built as HTML strings. Pure, so the Studio editor can preview in the browser.
import { SITE_URL } from "@/lib/urls";

// Garnet Rose paint (app/globals.css). Email clients ignore CSS variables, so they're spelled out.
export const EMAIL_COLORS = {
  ink: "#2e1219", // --af-ink
  ink2: "#694c54", // --af-ink-2
  garnet: "#8b2a4b", // --af-scan
  line: "#ecdcd8", // --af-line
  wall: "#f6ede9", // --af-wall
};
const C = EMAIL_COLORS;

export const EMAIL_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const EMAIL_CONTACT = "contact@theartfinity.com";
export const EMAIL_LOGO = `${SITE_URL}/brand/email-logo.png`;

export const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const emailH1 = (text: string) =>
  `<h1 style="margin:0 0 16px;font-size:24px;line-height:30px;font-weight:700;color:${C.ink};letter-spacing:-0.01em">${escHtml(text)}</h1>`;

/** A paragraph. `html` is trusted markup: escape anything user-written first. */
export const emailP = (html: string, opts: { muted?: boolean; small?: boolean; last?: boolean } = {}) =>
  `<p style="margin:0 0 ${opts.last ? 0 : 16}px;font-size:${opts.small ? 13 : 15}px;line-height:${opts.small ? 20 : 24}px;color:${opts.muted ? C.ink2 : C.ink}">${html}</p>`;

export const emailButton = (href: string, label: string, opts: { secondary?: boolean; last?: boolean } = {}) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 ${opts.last ? 0 : 24}px"><tr><td style="border-radius:8px;background:${opts.secondary ? "#ffffff" : C.garnet}">` +
  `<a href="${escHtml(href)}" style="display:inline-block;padding:12px 22px;border:1px solid ${C.garnet};border-radius:8px;font-size:15px;font-weight:600;line-height:20px;text-decoration:none;color:${opts.secondary ? C.garnet : "#ffffff"}">${escHtml(label)}</a>` +
  `</td></tr></table>`;

export const emailLink = (href: string, label: string) => `<a href="${escHtml(href)}" style="color:${C.garnet};text-decoration:underline">${escHtml(label)}</a>`;

const footP = (html: string, first = false) => `<p style="margin:${first ? 0 : 8}px 0 0;font-size:12px;line-height:18px;color:${C.ink2}">${html}</p>`;
const footLink = (href: string, label: string) => `<a href="${escHtml(href)}" style="color:${C.ink2};text-decoration:underline">${escHtml(label)}</a>`;

/**
 * Wraps the card content in the full frame. `footer` lines are trusted HTML (why they got it, unsubscribe…).
 * Background sits on an outer table, not <body>, so it survives clients (and the Studio preview) that drop <body>.
 */
export function emailShell(inner: string, opts: { preview?: string; footer?: string[]; contact?: boolean } = {}) {
  const preview = opts.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escHtml(opts.preview)}${"&#8202;&zwnj;".repeat(40)}</div>`
    : "";
  const foot = [
    opts.contact === false ? "" : `Questions? Reply to this email or write to ${footLink(`mailto:${EMAIL_CONTACT}`, EMAIL_CONTACT)}.`,
    ...(opts.footer ?? []),
    `Artfinity · ${footLink(SITE_URL, "theartfinity.com")}`,
  ].filter(Boolean);
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${C.wall}">${preview}` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.wall};font-family:${EMAIL_FONT};color:${C.ink}"><tr><td style="padding:32px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto">` +
    `<tr><td style="padding:0 8px 20px"><a href="${SITE_URL}"><img src="${EMAIL_LOGO}" width="114" height="24" alt="Artfinity" style="display:block;border:0"></a></td></tr>` +
    `<tr><td style="background:#ffffff;border:1px solid ${C.line};border-radius:12px;padding:36px 36px 32px">${inner}</td></tr>` +
    `<tr><td style="padding:20px 8px 0">${foot.map((l, i) => footP(l, i === 0)).join("")}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}
