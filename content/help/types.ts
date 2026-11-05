// Help center content types. Articles are plain TypeScript so numbers can come straight from the code
// (lib/plans.ts, lib/balance.ts, lib/printSizes.ts, ...) instead of being typed by hand.
//
// Body format (rendered by components/help/ArticleBody.tsx, searched as plain text):
//   ## Heading            a section (long articles get a table of contents from these)
//   ### Smaller heading
//   - item                a bulleted list (consecutive lines)
//   1. step               a numbered list
//   > text                a tip box
//   | a | b |             a table (first row is the header; a |---| row is skipped)
//   **bold**  [text](/path)  inline
// Blank lines separate blocks.

export type HelpSectionId = "getting-started" | "qr-codes" | "selling" | "getting-paid" | "growing" | "trust" | "buyers" | "account";

export type Audience = "artist" | "buyer" | "both";

export type HelpSection = {
  id: HelpSectionId;
  title: string;
  /** One line on the section card. */
  blurb: string;
  audience: Audience;
  /** Paint dab color. */
  dab: string;
};

export type HelpArticle = {
  slug: string;
  section: HelpSectionId;
  title: string;
  /** One or two sentences: the short answer. Used on cards, in search and as the meta description. */
  summary: string;
  audience: Audience;
  body: string;
  /** Slugs of related articles. */
  related?: string[];
  /** The matching Studio (or site) page. */
  link?: { href: string; label: string };
  /** Lower comes first in "Popular". */
  popular?: number;
  /** Include in the FAQPage structured data on /help. */
  faq?: boolean;
};
