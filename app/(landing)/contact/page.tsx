import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import ContactForm from "@/components/browse/ContactForm";
import { getAppConfigs } from "@/db/query";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with Artfinity." };

const cfg = getAppConfigs();

export default function ContactPage() {
  const cards: { color: string; title: string; sub: string; email: string; links?: [string, string][] }[] = [
    { color: "var(--af-scan)", title: "Orders and returns", sub: "Damaged, misprinted or wrong prints. We’ll make it right.", email: cfg.support_email || "support@theartfinity.com", links: [["Return policy", "/return-policy"]] },
    { color: "var(--af-sticker)", title: "Artists and everything else", sub: "Selling, partnerships, press, a café that wants art.", email: cfg.business_email || "contact@theartfinity.com", links: [["Sell with us", "/sell-with-us"]] },
  ];
  return (
    <div className="pb-24">
      <section className="mx-auto max-w-[1240px] px-4 pb-8 pt-10 sm:px-6 md:pb-10 md:pt-16">
        <h1 className="display text-[44px] sm:text-[64px]">Say hello.</h1>
        <p className="mt-3 text-[17px] text-ink-2">We answer most messages within a day.</p>
      </section>
      <section className="mx-auto grid max-w-[1240px] items-start gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-12">
        {/* The form comes first on phones; the direct emails sit under it. */}
        <div className="order-last grid gap-5 lg:order-none">
          <h2 className="eyebrow">Or email us</h2>
          {cards.map((c) => (
            <div key={c.title} className="border-t border-line pt-4">
              <div className="grid min-w-0 gap-1.5">
                <h3 className="t-card">{c.title}</h3>
                <p className="t-muted">{c.sub}</p>
                <a href={`mailto:${c.email}`} className="inline-flex w-fit max-w-full items-center gap-1.5 font-semibold text-scan underline-offset-2 hover:underline [overflow-wrap:anywhere]"><Mail className="h-4 w-4 shrink-0" aria-hidden="true" />{c.email}</a>
                {c.links?.map(([l, h]) => <Link key={h} href={h} className="w-fit text-[14.5px] font-semibold text-ink underline-offset-2 hover:underline">{l}</Link>)}
              </div>
            </div>
          ))}
          <p className="t-muted flex items-center gap-2 border-t border-line pt-4"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{cfg.business_name}, {cfg.business_address}</p>
        </div>
        <ContactForm />
      </section>
    </div>
  );
}
