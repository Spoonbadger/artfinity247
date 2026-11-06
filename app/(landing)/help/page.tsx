import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import HelpSearch from "@/components/help/HelpSearch";
import { HelpHeader, StillStuck } from "@/components/help/HelpShell";
import { HELP_SECTIONS, articleHref, articlesIn, faqArticles, popularArticles, searchDocs } from "@/content/help";
import { SITE_URL } from "@/lib/urls";

export const metadata: Metadata = {
  title: "Help center",
  description: "Answers for artists and buyers: getting started, QR codes, pricing, payouts, shipping, damaged prints and your account.",
  alternates: { canonical: "/help" },
};

const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export default function HelpIndex() {
  const docs = searchDocs();
  const popular = popularArticles(6);
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqArticles().map((a) => ({
      "@type": "Question",
      name: a.title,
      acceptedAnswer: { "@type": "Answer", text: a.summary, url: `${SITE_URL}${articleHref(a)}` },
    })),
  };

  return (
    <div className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      <HelpHeader title="How can we help?" sub="Short answers for artists and buyers.">
        <div className="mt-7 max-w-[680px]">
          <HelpSearch docs={docs} />
        </div>
      </HelpHeader>

      <div className="mx-auto grid max-w-[1240px] gap-12 px-4 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <section aria-labelledby="topics-h" className="min-w-0">
          <h2 id="topics-h" className="display mb-5 text-[32px] sm:text-[40px]">Topics</h2>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4">
            {HELP_SECTIONS.map((s) => {
              const items = articlesIn(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/help/${s.id}`} className="af-card group grid h-full content-start gap-2 p-4 no-underline sm:p-5 transition hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_6px_0_rgba(21,22,27,.9)]">
                    <span className="flex items-center gap-2.5">
                      <i className="paint-dab h-5 w-5" style={{ ["--dab" as string]: s.dab }} aria-hidden="true" />
                      <b className="font-display text-[20px] leading-none text-ink [font-variation-settings:'wdth'_80] sm:text-[24px]">{s.title}</b>
                    </span>
                    <span className="hidden text-[15px] text-ink-2 sm:block">{s.blurb}</span>
                    <span className="mt-1 flex items-center gap-1 text-[13.5px] font-semibold text-scan">
                      {items.length} articles <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-10 lg:hidden"><StillStuck /></div>
        </section>

        <aside className="order-first grid content-start gap-8 lg:order-none">
          <section aria-labelledby="popular-h">
            <h2 id="popular-h" className="display mb-4 text-[32px]">Popular</h2>
            <ol className="grid divide-y divide-line border-y border-line">
              {popular.map((a) => (
                <li key={a.slug}>
                  <Link href={articleHref(a)} className="flex items-start gap-3 py-3 text-[15.5px] font-semibold leading-snug text-ink no-underline hover:text-scan">
                    <i className="paint-dab mt-1.5 h-2.5 w-2.5" style={{ ["--dab" as string]: HELP_SECTIONS.find((s) => s.id === a.section)?.dab }} aria-hidden="true" />
                    {a.title}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          <div className="hidden lg:block"><StillStuck /></div>
        </aside>
      </div>
    </div>
  );
}
