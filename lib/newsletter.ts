// Newsletter email rendering. Pure, so the Studio composer previews exactly what gets sent.
import { COMPANY } from "@/lib/about";

export const MAX_ARTWORKS = 4;
export const MAX_SUBJECT = 120;
export const MAX_BODY = 6000;
export const SEND_GAP_MS = 24 * 60 * 60 * 1000; // one newsletter per artist per day

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const FONT = "-apple-system,Segoe UI,Helvetica,Arial,sans-serif";

/** Inline marks on already-escaped text: **bold**, _italic_, [text](https://…), bare links. */
function inline(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,!?]|$)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#2b37f0">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" style="color:#2b37f0">$2</a>');
}

/** Markdown-lite: blank line = new paragraph, "- " lines = a list. */
export function bodyHtml(body: string) {
  return body
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-*] /.test(l))) {
        return `<ul style="margin:0 0 16px;padding-left:22px">${lines.map((l) => `<li style="margin:0 0 4px">${inline(esc(l.replace(/^\s*[-*] /, "")))}</li>`).join("")}</ul>`;
      }
      return `<p style="margin:0 0 16px">${lines.map((l) => inline(esc(l))).join("<br>")}</p>`;
    })
    .join("");
}

export function bodyText(body: string) {
  return body.replace(/\r\n/g, "\n").trim().replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)");
}

/** Physical address and the unsubscribe link (CAN-SPAM). */
export function emailFooter({ unsubscribe, artistName, base }: { unsubscribe?: string; artistName?: string; base: string }) {
  const why = artistName ? `You get this because you follow ${esc(artistName)} on Artfinity.` : "Sent by Artfinity.";
  return (
    `<div style="margin:28px 0 0;padding-top:14px;border-top:1px solid #e6e3dc;font-size:12.5px;line-height:1.5;color:#5b5d66">` +
    `<p style="margin:0 0 6px">${why}${unsubscribe ? ` <a href="${unsubscribe}" style="color:#5b5d66">Unsubscribe</a>` : ""}</p>` +
    `<p style="margin:0">${esc(COMPANY.legalName)} · ${esc(COMPANY.address)} · <a href="${base}" style="color:#5b5d66">theartfinity.com</a></p>` +
    `</div>`
  );
}

export type NewsletterArt = { title: string; imageUrl: string; url: string };

const absolute = (url: string, base: string) => (/^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`);

export function renderNewsletter(opts: {
  artistName: string;
  avatar?: string | null;
  artistUrl: string;
  subject: string;
  body: string;
  artworks: NewsletterArt[];
  unsubscribe: string;
  base: string;
}) {
  const { base } = opts;
  const cards = opts.artworks.slice(0, MAX_ARTWORKS);
  const grid = cards.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 0;margin:6px 0 8px">` +
      chunk(cards, 2)
        .map(
          (row) =>
            `<tr>${row
              .map(
                (a) =>
                  `<td width="50%" valign="top" style="padding:0 6px 14px">` +
                  `<a href="${a.url}" style="color:#15161b;text-decoration:none">` +
                  `<img src="${absolute(a.imageUrl, base)}" alt="${esc(a.title)}" width="250" style="display:block;width:100%;height:auto;border-radius:6px;background:#f3f0ea">` +
                  `<span style="display:block;margin:8px 0 2px;font-weight:700;font-size:15px">${esc(a.title)}</span></a>` +
                  `<a href="${a.url}" style="font-size:14px;font-weight:700;color:#2b37f0;text-decoration:none">Buy a print &rarr;</a>` +
                  `</td>`,
              )
              .join("")}${row.length === 1 ? `<td width="50%"></td>` : ""}</tr>`,
        )
        .join("") +
      `</table>`
    : "";
  const avatar = opts.avatar
    ? `<img src="${absolute(opts.avatar, base)}" alt="" width="44" height="44" style="display:inline-block;vertical-align:middle;width:44px;height:44px;border-radius:50%;object-fit:cover;margin-right:10px">`
    : "";

  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.subject)}</title></head>` +
    `<body style="margin:0;background:#f7f5f0">` +
    `<div style="font-family:${FONT};font-size:16px;line-height:1.6;color:#15161b;max-width:580px;margin:0 auto;padding:24px 18px;background:#fff">` +
    `<p style="margin:0 0 18px"><a href="${opts.artistUrl}" style="color:#15161b;text-decoration:none;font-weight:700">${avatar}${esc(opts.artistName)}</a></p>` +
    `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.15">${esc(opts.subject || "New work")}</h1>` +
    bodyHtml(opts.body) +
    grid +
    `<p style="margin:8px 0 0"><a href="${opts.artistUrl}" style="display:inline-block;border:2px solid #15161b;color:#15161b;font-weight:700;text-decoration:none;padding:9px 18px;border-radius:999px">See all of ${esc(opts.artistName.split(" ")[0])}'s work</a></p>` +
    emailFooter({ unsubscribe: opts.unsubscribe, artistName: opts.artistName, base }) +
    `</div></body></html>`;

  const text =
    `${opts.subject}\n\n${bodyText(opts.body)}\n\n` +
    cards.map((a) => `${a.title}: ${a.url}`).join("\n") +
    `\n\nAll work: ${opts.artistUrl}\n\n--\nYou follow ${opts.artistName} on Artfinity. Unsubscribe: ${opts.unsubscribe}\n${COMPANY.legalName}, ${COMPANY.address}`;
  return { html, text };
}

function chunk<T>(a: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
