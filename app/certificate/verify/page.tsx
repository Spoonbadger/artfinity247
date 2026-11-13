// /certificate/verify?n=AF-XXXXXXXX-12 : public check that a certificate number is real.
// Shows the piece, the artist and the print number. Nothing about the buyer.
import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, SearchX } from "lucide-react";
import { findCertificate } from "@/lib/certificates";
import { artPath } from "@/lib/urls";
import SiteHeader from "@/components/site/SiteHeader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify a certificate", robots: { index: false, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: { n?: string } }) {
  const n = typeof searchParams.n === "string" ? searchParams.n.trim().slice(0, 40) : "";
  const c = n ? await findCertificate(n) : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-[560px] gap-6 px-4 py-10 sm:py-14">
        <div>
          <p className="eyebrow">Certificate of authenticity</p>
          <h1 className="t-page mt-1">Verify a print</h1>
          <p className="t-muted mt-2">The number is at the bottom right of the certificate.</p>
        </div>

        {n && c && (
          <section className="af-card grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-5" aria-live="polite">
            {c.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt={c.title} className="h-auto w-[120px] rounded-[2px] shadow-[0_8px_18px_-8px_rgba(21,22,27,.45)]" />
            )}
            <div className="grid content-start gap-1.5">
              <p className="flex items-center gap-1.5 text-[14px] font-bold text-earned">
                <BadgeCheck className="h-[18px] w-[18px]" aria-hidden /> Genuine Artfinity edition
              </p>
              <h2 className="t-card">{c.title}</h2>
              <p className="text-ink-2">by {c.artist}</p>
              <p className="num mt-1 w-fit rounded-full bg-sticker px-2.5 py-0.5 text-[14px] font-bold">Print {c.printNo} of {c.editionSize}</p>
              <p className="t-small num">Certificate {c.number}</p>
              {c.artistHandle && c.slug && (
                <Link href={artPath(c.artistHandle, c.slug)} className="mt-1 text-[14px] font-semibold text-scan underline-offset-2 hover:underline">See the piece</Link>
              )}
            </div>
          </section>
        )}

        {n && !c && (
          <section className="af-panel flex items-start gap-3 p-4" aria-live="polite">
            <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-coral" aria-hidden />
            <p className="text-[15px]">
              <b className="block">No certificate with that number.</b>
              <span className="text-ink-2">Check it against the certificate, e.g. AF-7SAG5VRD-12. Still stuck? <Link href="/contact" className="font-semibold text-scan hover:underline">Ask us</Link>.</span>
            </p>
          </section>
        )}

        <form action="/certificate/verify" method="get" className="grid gap-2">
          <label className="af-field">
            <span className="label">Certificate number</span>
            <input name="n" defaultValue={n} placeholder="AF-XXXXXXXX-12" autoComplete="off" spellCheck={false} className="num uppercase" />
          </label>
          <button type="submit" className="btn btn-blue justify-self-start">Check it</button>
        </form>
      </main>
    </>
  );
}
