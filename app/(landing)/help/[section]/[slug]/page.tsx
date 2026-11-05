import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import ArticleBody, { parseHeadings } from "@/components/help/ArticleBody";
import Helpful from "@/components/help/Helpful";
import { HelpHeader, SectionNav, StillStuck } from "@/components/help/HelpShell";
import { PROSE } from "@/components/browse/LongForm";
import { HELP_ARTICLES, articleHref, getArticle, relatedArticles, sectionById } from "@/content/help";
import { SITE_URL } from "@/lib/urls";

export const dynamicParams = false;
export const generateStaticParams = () => HELP_ARTICLES.map((a) => ({ section: a.section, slug: a.slug }));

const find = (p: { section: string; slug: string }) => {
  const a = getArticle(p.slug);
  return a && a.section === p.section ? a : undefined;
};

export function generateMetadata({ params }: { params: { section: string; slug: string } }): Metadata {
  const a = find(params);
  if (!a) return {};
  return {
    title: `${a.title} · Help`,
    description: a.summary,
    alternates: { canonical: articleHref(a) },
    openGraph: { title: a.title, description: a.summary, type: "article", url: `${SITE_URL}${articleHref(a)}` },
  };
}

const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

export default function HelpArticlePage({ params }: { params: { section: string; slug: string } }) {
  const a = find(params);
  if (!a) notFound();
  const s = sectionById(a.section)!;
  const headings = parseHeadings(a.body);
  const related = relatedArticles(a);
  const studio = a.link?.href.startsWith("/studio");
  const crumbs = [{ label: "Help center", href: "/help" }, { label: s.title, href: `/help/${s.id}` }, { label: a.title }];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: `${SITE_URL}${c.href ?? articleHref(a)}` })),
  };

  return (
    <div className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }} />
      <HelpHeader title={a.title} sub={a.summary} crumbs={crumbs}>
        {a.link && (
          <Link href={a.link.href} className="btn btn-ghost btn-sm mt-5">
            {a.link.label} {studio ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Link>
        )}
      </HelpHeader>

      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-8 sm:px-6 md:pt-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <div className="order-last lg:order-first"><SectionNav current={s.id} /></div>

        <div className="grid min-w-0 content-start gap-10">
          {headings.length >= 3 && (
            <nav aria-labelledby="toc-h" className="af-panel max-w-[68ch] px-5 py-4">
              <h2 id="toc-h" className="eyebrow mb-2">On this page</h2>
              <ol className="grid gap-1 text-[15px]">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${h.id}`} className="inline-flex min-h-[32px] items-center gap-2 font-semibold text-ink no-underline hover:text-scan">
                      <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: s.dab }} aria-hidden="true" />
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <article className={PROSE}>
            <ArticleBody body={a.body} />
          </article>

          <div className="grid max-w-[68ch] gap-4">
            {a.link && studio && (
              <p className="text-[15px] text-ink-2">
                Ready to try it? <Link href={a.link.href} className="font-semibold text-scan underline underline-offset-2">{a.link.label} in the Studio</Link>
              </p>
            )}
            <Helpful slug={a.slug} />
          </div>

          {related.length > 0 && (
            <section aria-labelledby="related-h" className="max-w-[68ch]">
              <h2 id="related-h" className="display mb-3 text-[28px]">Related</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={articleHref(r)} className="af-panel grid h-full content-start gap-1 p-4 no-underline hover:border-ink">
                      <b className="text-[15.5px] leading-snug text-ink">{r.title}</b>
                      <span className="line-clamp-2 text-[14px] text-ink-2">{r.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="max-w-[68ch]"><StillStuck /></div>
        </div>
      </div>
    </div>
  );
}
