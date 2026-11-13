import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { HelpHeader, SectionNav, StillStuck } from "@/components/help/HelpShell";
import { HELP_SECTIONS, articleHref, articlesIn, sectionById } from "@/content/help";

export const dynamicParams = false;
export const generateStaticParams = () => HELP_SECTIONS.map((s) => ({ section: s.id }));

export function generateMetadata({ params }: { params: { section: string } }): Metadata {
  const s = sectionById(params.section);
  if (!s) return {};
  return { title: `${s.title} · Help`, description: s.blurb, alternates: { canonical: `/help/${s.id}` } };
}


export default function HelpSectionPage({ params }: { params: { section: string } }) {
  const s = sectionById(params.section);
  if (!s) notFound();
  const items = articlesIn(s.id);

  return (
    <div className="pb-24">
      <HelpHeader title={s.title} sub={s.blurb} crumbs={[{ label: "Help center", href: "/help" }, { label: s.title }]} />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <div className="order-last lg:order-first"><SectionNav current={s.id} /></div>
        <div className="grid min-w-0 max-w-[760px] content-start gap-10">
          <section aria-label={`${s.title} articles`}>
            <ul className="grid divide-y divide-line border-y border-line">
              {items.map((a) => (
                <li key={a.slug}>
                  <Link href={articleHref(a)} className="group grid gap-1 py-4 no-underline">
                    <b className="flex items-start justify-between gap-3 text-[18px] leading-snug text-ink group-hover:text-scan">
                      {a.title}
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-2 transition group-hover:translate-x-0.5 group-hover:text-scan" aria-hidden="true" />
                    </b>
                    <span className="max-w-[64ch] text-[15px] leading-relaxed text-ink-2">{a.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <StillStuck />
        </div>
      </div>
    </div>
  );
}
