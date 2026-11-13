"use client";

// Client-side search over the help articles: titles, summaries and bodies. No dependency.
// Each query word must match somewhere (exact substring, a word prefix, a synonym, or one typo in a title/summary word).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { SearchDoc } from "@/content/help";

const SYNONYMS: Record<string, string[]> = {
  paid: ["payout", "pay", "stripe", "bank"],
  payed: ["paid", "payout"],
  pay: ["payout", "paid"],
  payout: ["paid", "pay"],
  money: ["payout", "earn", "paid"],
  earn: ["earnings", "share", "profit"],
  bank: ["stripe"],
  qr: ["code"],
  code: ["qr"],
  shipping: ["delivery", "ship", "arrive"],
  delivery: ["shipping", "arrive"],
  refund: ["return", "reprint"],
  return: ["refund", "reprint"],
  broken: ["damaged"],
  damaged: ["reprint"],
  price: ["pricing", "prices"],
  delete: ["close"],
  cancel: ["close", "unsubscribe"],
  username: ["handle"],
  resolution: ["pixels", "sharp"],
  dpi: ["pixels", "sharp"],
  blurry: ["sharp", "pixels", "soft"],
  tax: ["taxes"],
  frame: ["frames", "framed"],
  ai: ["training"],
  stolen: ["copied", "dmca", "report"],
  copy: ["copied", "dmca", "copyright"],
  sticker: ["sheet", "label"],
  email: ["newsletter", "emails"],
};

const STOP = new Set(["a", "an", "the", "i", "my", "me", "do", "does", "is", "are", "can", "how", "what", "when", "where", "why", "who", "to", "of", "for", "on", "in", "it", "get", "will", "be", "with", "and", "or", "you", "your"]);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (s: string) => norm(s).split(/[^a-z0-9%]+/).filter(Boolean);

function oneEdit(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

type Prepared = SearchDoc & { t: string; s: string; b: string; tw: string[] };

function score(d: Prepared, terms: string[]) {
  let total = 0;
  let matched = 0;
  for (const term of terms) {
    const alts = [term, ...(SYNONYMS[term] || [])];
    let best = 0;
    for (const [i, w] of alts.entries()) {
      const weight = i === 0 ? 1 : 0.6;
      const hit = d.t.includes(w) ? 6 : d.s.includes(w) ? 3 : d.b.includes(w) ? 1 : 0;
      best = Math.max(best, hit * weight);
    }
    if (!best && term.length >= 4 && d.tw.some((w) => oneEdit(term, w))) best = 2;
    if (best) matched++;
    total += best;
  }
  // Every word must match, except one miss is allowed in queries of three or more words.
  return matched >= (terms.length >= 3 ? terms.length - 1 : terms.length) ? total * (matched / terms.length) : 0;
}

export default function HelpSearch({ docs, autoFocus = false }: { docs: SearchDoc[]; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const prepared = useMemo<Prepared[]>(
    () => docs.map((d) => ({ ...d, t: norm(d.title), s: norm(d.summary), b: norm(d.text), tw: words(`${d.title} ${d.summary}`) })),
    [docs],
  );
  const terms = useMemo(() => {
    const all = words(q).filter((w) => w.length > 1 || /\d/.test(w));
    const kept = all.filter((w) => !STOP.has(w));
    return kept.length ? kept : all;
  }, [q]);
  const results = useMemo(() => {
    if (!terms.length) return [];
    return prepared
      .map((d) => ({ d, n: score(d, terms) }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 8)
      .map((r) => r.d);
  }, [prepared, terms]);

  // "/" focuses the search box, like most help centers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === "/" && !(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative" role="search" aria-label="Search help">
      <label className="flex min-h-[56px] items-center gap-3 rounded-2xl border-2 border-ink bg-white px-4 shadow-[0_6px_0_rgba(21,22,27,.9)] transition focus-within:border-scan">
        <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
        <span className="sr-only">Search the help center</span>
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
          placeholder="Payouts, file size, damaged print…"
          autoFocus={autoFocus}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3 text-[17px] outline-none placeholder:text-ink-2 [&::-webkit-search-cancel-button]:hidden"
          aria-controls="help-results"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); input.current?.focus(); }} className="grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink" aria-label="Clear search">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </label>

      <div id="help-results" aria-live="polite">
        {terms.length > 0 && (
          <div className="mt-4 rounded-2xl border border-edge bg-white p-2 shadow-[0_18px_40px_-12px_rgba(21,22,27,.25)]">
            {results.length ? (
              <ul className="grid">
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link href={r.href} className="grid gap-0.5 rounded-xl px-3 py-3 no-underline hover:bg-wall focus-visible:bg-wall">
                      <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-2">{r.sectionTitle}</span>
                      <b className="text-[16.5px] leading-snug text-ink">{r.title}</b>
                      <span className="line-clamp-2 text-[14.5px] text-ink-2">{r.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-4 text-[15px] text-ink-2">
                Nothing found for &ldquo;{q.trim()}&rdquo;. Try another word, or <Link href="/contact" className="font-semibold text-scan underline underline-offset-2">message us</Link>.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
