import { Mrs_Saint_Delafield } from "next/font/google";
import { BrushStroke } from "@/components/af/Brush";
import { SIZE_LABEL, sizeInches } from "@/components/art/pricing";
import { qrSVG } from "@/lib/qr/render";
import { VERIFY_HOST, verifyPath, type Certificate } from "@/lib/certificates";

const script = Mrs_Saint_Delafield({ weight: "400", subsets: ["latin"], display: "swap" });

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** One Letter-size certificate. Prints edge to edge (see the @page rule in the certificate page). */
export default function CertificateSheet({ c }: { c: Certificate }) {
  const verify = `${VERIFY_HOST}${verifyPath(c.number)}`;
  const qr = qrSVG(`https://${verify}`, { quiet: 0 });
  return (
    <article className="cert-sheet relative mx-auto flex flex-col bg-[#fffdf8] text-ink shadow-[0_18px_50px_-18px_rgba(21,22,27,.35)] print:shadow-none">
      {/* double rule, hand-set */}
      <div aria-hidden className="pointer-events-none absolute inset-[0.35in] rounded-[3px] border-[2.5px] border-ink" />
      <div aria-hidden className="pointer-events-none absolute inset-[0.45in] rounded-[2px] border border-ink/40" />

      <div className="relative flex flex-1 flex-col items-center px-[0.85in] pb-[0.7in] pt-[0.75in] text-center">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="Artfinity" className="h-[22px] w-auto" />
        </div>
        <p className="eyebrow mt-3 !text-[11px] !tracking-[0.28em] !text-ink">Certificate of authenticity</p>

        <div className="mt-6 grid place-items-center">
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.imageUrl}
              alt={c.title}
              className="max-h-[3.4in] max-w-[5.4in] border-[6px] border-white object-contain shadow-[0_10px_24px_-8px_rgba(21,22,27,.45)] ring-1 ring-ink/10"
            />
          ) : (
            <div className="h-[3in] w-[2.4in] bg-wall" />
          )}
        </div>

        <h1 className="display mt-6 max-w-[6in] text-[40px] leading-[0.95]">{c.title}</h1>
        <p className="mt-1.5 text-[16px] text-ink-2">by <b className="font-semibold text-ink">{c.artist}</b></p>

        <div className="relative mt-5 inline-block px-4">
          <BrushStroke className="absolute inset-x-0 bottom-[2px] -z-0 h-[18px] w-full" />
          <p className="num relative font-display text-[30px] font-extrabold leading-none [font-variation-settings:'wdth'_80]">
            Print {c.printNo} of {c.editionSize}
          </p>
        </div>
        <p className="mt-2 text-[13px] text-ink-2">Limited edition. No more than {c.editionSize} prints will ever be made, in any size.</p>

        <dl className="mt-6 grid w-full max-w-[6.2in] grid-cols-2 gap-x-8 gap-y-3 border-y border-ink/20 py-4 text-left text-[13px] leading-snug">
          <div><dt className="eyebrow !text-[10px]">Size</dt><dd className="num mt-0.5">{SIZE_LABEL[c.size]} · {sizeInches(c.size)}</dd></div>
          <div><dt className="eyebrow !text-[10px]">Ordered</dt><dd className="num mt-0.5">{longDate(c.orderDate)}</dd></div>
          <div className="col-span-2"><dt className="eyebrow !text-[10px]">Print</dt><dd className="mt-0.5">12-color giclée on smooth matte, FSC-certified 310gsm archival paper, with a ½-inch border</dd></div>
        </dl>

        <div className="mt-auto flex w-full max-w-[6.2in] items-end justify-between gap-6 pt-6 text-left">
          <div className="min-w-0">
            <p className={`${script.className} -mb-1 truncate text-[46px] leading-none`}>{c.artist}</p>
            <div className="h-px w-[2.6in] bg-ink" />
            <p className="mt-1 text-[11px] text-ink-2">Artist</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-right text-[11px] leading-snug text-ink-2">
              <p className="eyebrow !text-[10px]">Certificate no.</p>
              <p className="num mt-0.5 text-[14px] font-bold tracking-wide text-ink">{c.number}</p>
              <p className="mt-1.5">Verify at <span className="font-semibold text-ink">{VERIFY_HOST}/certificate/verify</span></p>
            </div>
            <span className="cert-qr block h-[0.8in] w-[0.8in] shrink-0" aria-label={`QR code: ${verify}`} role="img" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
        </div>
      </div>
    </article>
  );
}
