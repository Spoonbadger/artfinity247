import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { qrSVG } from "@/lib/qr/render";
import { SITE_URL } from "@/lib/urls";
import Logo from "@/components/af/Logo";
import { adminRoleOrRedirect } from "../../../_components/gate";
import PrintButton from "../../_components/PrintButton";
import { hangingAt, pctLabel } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Venue kit" };

/**
 * Printable venue kit (Print → Save as PDF): a window sticker with a QR code to the public venue page, and a
 * thank-you note for the owner. Two US Letter pages; the admin chrome is hidden when printing.
 */
export default async function VenueKitPage({ params }: { params: { id: string } }) {
  await adminRoleOrRedirect(`/admin/venues/${params.id}`);
  const v = await prisma.venue.findUnique({ where: { id: params.id } });
  if (!v) notFound();
  const { artworks, artistPages } = await hangingAt(v.id);
  const artists = Array.from(new Set([...artworks.map((a) => a.artist.name), ...artistPages.map((a) => a.name)]));
  const url = `${SITE_URL}/venues/${v.slug}`;
  const shown = url.replace(/^https?:\/\//, "");
  const qr = qrSVG(url, { dots: "rounded", eyes: "frame", eyeColor: "#2b37f0", logo: true, quiet: 1, label: `QR code to ${shown}` });

  return (
    <div className="grid gap-5">
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: letter; margin: 0.5in; }
        @media print {
          header, nav[aria-label="Admin"], .no-print { display: none !important; }
          html, body, .bg-wall { background: #fff !important; }
          main { padding: 0 !important; }
          .kit-page { box-shadow: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; break-after: page; min-height: 0 !important; }
          .kit-page:last-child { break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      ` }} />
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/venues/${v.id}`} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-ink-2 no-underline hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{v.name}</Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">Sticker prints at 6 × 6 in.</span>
          <PrintButton className="btn btn-blue btn-sm" label="Print or save PDF" />
        </div>
      </div>

      {/* Page 1: window sticker */}
      <section aria-label="Window sticker" className="kit-page grid min-h-[10in] grid-cols-[minmax(0,1fr)] place-items-center rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <div className="grid w-full max-w-[6in] justify-items-center gap-4 rounded-[28px] border-[6px] border-ink bg-sticker px-5 pb-7 pt-8 text-center text-ink sm:px-8">
          <p className="display text-[44px] leading-[0.9] sm:text-[64px]">Local art here</p>
          <p className="text-[22px] font-bold">Scan to buy a print</p>
          <div className="w-full max-w-[3.1in] rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-[17px] font-semibold">The art on these walls is by local artists, and it&apos;s for sale.</p>
          <p className="num text-[14px] font-semibold">{shown}</p>
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <span>{v.name} is an</span>
            <Logo href={null} className="text-[20px]" />
            <span>partner venue</span>
          </div>
        </div>
      </section>

      {/* Page 2: thank-you note */}
      <section aria-label="Thank-you note" className="kit-page min-h-[10in] rounded-2xl border border-line bg-white p-8 shadow-sm sm:p-12">
        <div className="mx-auto grid max-w-[6.5in] gap-5 text-[16px] leading-relaxed text-ink">
          <Logo href={null} className="text-[26px]" />
          <h1 className="display text-[40px]">Thank you, {v.name}.</h1>
          <p>Dear {v.contactName || `${v.name} team`},</p>
          <p>
            Thank you for giving local artists a wall. When someone stops to look at a painting and scans the small code beside it, they can buy a print
            on the spot, and the artist gets paid. Your space is how that first look happens.
          </p>
          {artists.length > 0 && (
            <p>
              Hanging with you right now: {artworks.length > 0 ? `${artworks.length} ${artworks.length === 1 ? "piece" : "pieces"} ` : "work "}by {artists.join(", ")}.
            </p>
          )}
          <p>
            You now have your own page on Artfinity, <b>{shown}</b>, with every piece on your walls and your address, so neighbors can find you.
            The sticker in this kit links to it: put it on your window or by the register.
          </p>
          {v.sharePct > 0 ? (
            <p>
              As a partner venue you get <b>{pctLabel(v.sharePct)} of Artfinity&apos;s profit</b> on every print sold from the codes on your walls. Each month we send
              a short statement along with the payment.
            </p>
          ) : (
            <p>Every month we can send you a short note on what sold from your walls. Just reply if you&apos;d like it.</p>
          )}
          <p>Questions, or want a different piece up? Write to us any time at contact@theartfinity.com.</p>
          <p>With thanks,<br />The Artfinity team</p>
        </div>
      </section>
    </div>
  );
}
