// /certificate/<orderItemId>?t=<sig> : printable certificates of authenticity for a limited-edition order line,
// one Letter page per print. Linked from the receipt, the shipped email, the artist's customer page and admin orders.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { certificatesFor, verifyCert } from "@/lib/certificates";
import { artPath } from "@/lib/urls";
import CertificateSheet from "../CertificateSheet";
import PrintButton from "../PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Certificate of authenticity", robots: { index: false, follow: false } };

export default async function CertificatePage({ params, searchParams }: { params: { id: string }; searchParams: { t?: string } }) {
  if (!verifyCert(params.id, searchParams.t)) notFound();
  const certs = await certificatesFor(params.id);
  if (!certs.length) notFound();
  const c = certs[0];

  return (
    <main className="min-h-screen bg-wall px-4 py-6 print:bg-white print:p-0 sm:py-10">
      {/* Letter, edge to edge; the sheet draws its own margins */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: letter; margin: 0; }
        .cert-sheet { width: 8.5in; min-height: 11in; }
        .cert-qr svg { width: 100%; height: 100%; display: block; }
        @media screen and (max-width: 900px) { .cert-sheet { zoom: calc((100vw - 32px) / 8.5in); } }
        @media print {
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cert-sheet { height: 11in; min-height: 0; break-after: page; overflow: hidden; }
          .cert-sheet:last-child { break-after: auto; }
        }
      ` }} />

      <div className="mx-auto mb-5 flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="leading-tight">
          <p className="eyebrow">Certificate of authenticity</p>
          <p className="text-[15px]">
            <b>{c.title}</b> · {certs.length > 1 ? `${certs.length} prints, one page each` : `Print ${c.printNo} of ${c.editionSize}`}
          </p>
        </div>
        <div className="flex gap-2">
          {c.artistHandle && c.slug && <Link href={artPath(c.artistHandle, c.slug)} className="btn btn-ghost btn-sm">See the piece</Link>}
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-8 print:block">
        {certs.map((x) => <CertificateSheet key={x.number} c={x} />)}
      </div>
    </main>
  );
}
