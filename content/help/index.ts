// The help center's articles, in section order. Server only (facts.ts reads some numbers from Prisma-backed modules).
import type { HelpArticle, HelpSectionId } from "./types";
import { HELP_SECTIONS, sectionById } from "./sections";
import { gettingStarted } from "./articles/getting-started";
import { qrCodes } from "./articles/qr-codes";
import { selling } from "./articles/selling";
import { gettingPaid } from "./articles/getting-paid";
import { growing } from "./articles/growing";
import { trust } from "./articles/trust";
import { buyers } from "./articles/buyers";
import { account } from "./articles/account";
import { PAINTING_SCANS } from "@/lib/features";

export { HELP_SECTIONS, sectionById };
export type { HelpArticle, HelpSectionId };

// Articles about features that are switched off (lib/features.ts) are left out of the help center.
const HIDDEN = new Set<string>(PAINTING_SCANS ? [] : ["painting-scans"]);

export const HELP_ARTICLES: HelpArticle[] = [...gettingStarted, ...qrCodes, ...selling, ...gettingPaid, ...growing, ...trust, ...buyers, ...account].filter((a) => !HIDDEN.has(a.slug));

const bySlug = new Map(HELP_ARTICLES.map((a) => [a.slug, a]));
if (bySlug.size !== HELP_ARTICLES.length) throw new Error("Help: duplicate article slug");

export const getArticle = (slug: string) => bySlug.get(slug);
export const articlesIn = (section: string) => HELP_ARTICLES.filter((a) => a.section === section);
export const articleHref = (a: Pick<HelpArticle, "section" | "slug">) => `/help/${a.section}/${a.slug}`;

/** Popular list: articles with a `popular` rank, buyer and artist mixed, lowest rank first. */
export function popularArticles(n = 8) {
  return HELP_ARTICLES.filter((a) => a.popular != null)
    .sort((a, b) => a.popular! - b.popular! || HELP_ARTICLES.indexOf(a) - HELP_ARTICLES.indexOf(b))
    .slice(0, n);
}

export const faqArticles = () => HELP_ARTICLES.filter((a) => a.faq);

export function relatedArticles(a: HelpArticle, n = 4) {
  const picked = (a.related || []).map(getArticle).filter((x): x is HelpArticle => !!x && x.slug !== a.slug);
  for (const x of articlesIn(a.section)) {
    if (picked.length >= n) break;
    if (x.slug !== a.slug && !picked.includes(x)) picked.push(x);
  }
  return picked.slice(0, n);
}

/** Body markdown-lite to plain text (search, meta). */
export function plainText(body: string) {
  return body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^\s*(#{2,3}|[->]|\d+\.)\s+/gm, "")
    .replace(/^\|?-{3,}.*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type SearchDoc = { slug: string; href: string; section: string; sectionTitle: string; title: string; summary: string; text: string; audience: string };

/** Compact index for the client-side search box. */
export const searchDocs = (): SearchDoc[] =>
  HELP_ARTICLES.map((a) => ({
    slug: a.slug,
    href: articleHref(a),
    section: a.section,
    sectionTitle: sectionById(a.section)?.title || "",
    title: a.title,
    summary: a.summary,
    text: plainText(a.body),
    audience: a.audience,
  }));

/** Every /help/... link inside article bodies, for checking that none are broken. */
export function internalHelpLinks() {
  const out: { from: string; to: string }[] = [];
  for (const a of HELP_ARTICLES) for (const m of Array.from(a.body.matchAll(/\]\((\/help\/[^)#]+)\)/g))) out.push({ from: a.slug, to: m[1] });
  return out;
}
