// 404 inside the Studio: keeps the Studio menu (it renders inside the Studio layout) and offers the likely next stops.
// Shown for unknown /studio/... addresses (via [...missing]) and for pieces, codes or collections that aren't there.
import Link from "next/link";
import CrookedFrame from "@/components/browse/Crooked";

const STOPS = [
  { href: "/studio/art", label: "My art" },
  { href: "/studio/codes", label: "My codes" },
  { href: "/studio/qr", label: "Print a QR code" },
  { href: "/studio/sales", label: "Sales" },
];

export default function StudioNotFound() {
  return (
    <div className="mx-auto grid max-w-[1320px] justify-items-center gap-7 px-4 pb-16 pt-10 text-center sm:px-6 lg:px-10 lg:pt-14">
      <CrookedFrame>
        <b className="display text-[52px] text-scan sm:text-[60px]">404</b>
      </CrookedFrame>
      <div className="grid justify-items-center gap-3">
        <h1 className="display text-[40px] sm:text-[52px]">Nothing here.</h1>
        <p className="max-w-[48ch] text-[16px] text-ink-2">
          That Studio page moved, or the piece or code was deleted. Pick up from here.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Link href="/studio" className="btn btn-blue">Studio home</Link>
          {STOPS.map((s) => (
            <Link key={s.href} href={s.href} className="btn btn-ghost">{s.label}</Link>
          ))}
        </div>
        <p className="mt-2 text-[14.5px] text-ink-2">
          Looking for something specific? <Link href="/help" className="font-semibold text-ink underline underline-offset-4">Help center</Link>
          <span aria-hidden="true"> · </span>
          <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">Contact us</Link>
        </p>
      </div>
    </div>
  );
}
