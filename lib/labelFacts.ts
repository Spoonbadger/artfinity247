// What a printed QR card says (price, discount, title), and how a change compares with labels already on walls.
// Pure, so the Studio forms can warn before saving. The facts come from the card renderer itself
// (components/qr/card.ts printedFacts), so "what the label says" is exactly what was drawn.
import { dollars, printedFacts, sanitizeDesign, type ArtInfo } from "@/components/qr/card";

/** What one card shows. Only cards with a price are recorded (a card without one never goes out of date on price). */
export type LabelFacts = { priceCents: number; discountPct: number; title: string };

type ArtFacts = Pick<ArtInfo, "title" | "markups">;

/** The facts a card printed with `design` shows for `art`, or null when it shows no price. */
export function labelFacts(design: unknown, art: ArtFacts) {
  const d = sanitizeDesign(design);
  const f = printedFacts(d, art);
  if (f.priceShownCents == null) return null;
  return { priceCents: f.priceShownCents, discountPct: f.discountPct ?? 0, title: f.title ?? "", format: f.format, style: String(f.style), ink: String(f.ink), design: d };
}

/**
 * What a reprint of this code would say now: its saved look, its current discount (the code record is the truth for
 * the deal), the artwork's current title and prices. `showsTitle` false keeps the title out, as on the printed card.
 */
export function nowFacts(code: { design: unknown; discountPct: number | null }, art: ArtFacts, showsTitle = true): LabelFacts {
  const d = sanitizeDesign({ ...sanitizeDesign(code.design), showPrice: true, showTitle: showsTitle, disc: code.discountPct || 0 });
  const f = printedFacts(d, art);
  return { priceCents: f.priceShownCents ?? 0, discountPct: f.discountPct ?? 0, title: f.title ?? "" };
}

export type LabelDiff = "price" | "discount" | "title";

/** Which printed facts no longer match. A title only counts when the card printed one. */
export function diffLabel(printed: LabelFacts, now: LabelFacts): LabelDiff[] {
  const out: LabelDiff[] = [];
  if (printed.priceCents !== now.priceCents) out.push("price");
  if (printed.discountPct !== now.discountPct) out.push("discount");
  if (printed.title && printed.title !== now.title) out.push("title");
  return out;
}

/** "Prints from $55" (with "· 10% off" when the card had a discount badge). The words on the card. */
export const priceWords = (f: Pick<LabelFacts, "priceCents" | "discountPct">) => `Prints from ${dollars(f.priceCents)}${f.discountPct ? ` · ${f.discountPct}% off` : ""}`;

/** One printed label of a code, as the Studio forms get it: what it says, and what scans show now. */
export type PrintedLabel = LabelFacts & { code: string; qty: number; printedAt: string; now: LabelFacts; showsTitle: boolean; codeDiscount: number };

/**
 * The warning for a change about to be saved: which printed labels will disagree with what scans show, worded
 * for the artist. `next(label)` gives what that label's code will show after the change. null = nothing to say
 * (no labels, or the change doesn't touch anything a label shows).
 */
export function describeChange(labels: PrintedLabel[], next: (l: PrintedLabel) => LabelFacts): { title: string; body: string; gentle: boolean; codes: string[] } | null {
  const hit = labels.filter((l) => {
    const n = next(l);
    const changing = diffLabel(l.now, n).length > 0; // the change touches this code at all
    return changing && diffLabel(l, n).length > 0; // and its label won't match afterwards
  });
  if (!hit.length) return null;
  const count = hit.length;
  const first = hit[0], after = next(first);
  const diffs = diffLabel(first, after);
  const labelsWord = `${count} printed ${count === 1 ? "label" : "labels"}`;
  const show = count === 1 ? "shows" : "show";
  const samePrinted = hit.every((l) => l.priceCents === first.priceCents && l.discountPct === first.discountPct);
  let title: string, body: string;
  let gentle = false;
  if (diffs.includes("price") || diffs.includes("discount")) {
    const said = samePrinted ? `‘${priceWords(first)}’` : "older prices";
    title = `${labelsWord} ${show} ${said}`;
    const nowSay = after.discountPct ? `${dollars(after.priceCents)} with ${after.discountPct}% off` : dollars(after.priceCents);
    // Paying less than the label says is a nice surprise; paying more is the one people notice.
    gentle = hit.every((l) => next(l).priceCents <= l.priceCents);
    body = `After this change scans show ${nowSay}. ` + (gentle ? "Buyers pay less than the label says, so it can wait." : "People may notice the difference.");
    if (diffs.includes("title")) body += ` The title changes too.`;
  } else {
    title = `${labelsWord} ${show} the title ‘${first.title}’`;
    body = `After this change scans show ‘${after.title}’.`;
    gentle = true;
  }
  return { title, body, gentle, codes: Array.from(new Set(hit.map((l) => l.code))) };
}
