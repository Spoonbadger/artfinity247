"use client";

import Link from "next/link";
import Logo from "@/components/af/Logo";
import { useSensitivePref } from "@/components/site/useSensitivePref";

const COLS: [string, [string, string][]][] = [
  ["For artists", [["Start selling free", "/register"], ["How it works", "/#how"], ["Sell with us", "/sell-with-us"], ["Artist terms", "/artist-terms-and-agreement"]]],
  ["For collectors", [["Browse art", "/art"], ["Artists", "/artists"], ["Scenes by city", "/scenes"], ["Returns", "/return-policy"]]],
  ["Artfinity", [["About", "/about-us"], ["Contact", "/contact"], ["Privacy", "/privacy-policy"], ["Terms", "/terms-and-conditions"]]],
];

export default function SiteFooter() {
  const [showSensitive, setShowSensitive] = useSensitivePref();
  return (
    <footer className="border-t border-line bg-wall">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_repeat(3,1fr)]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-[30ch] text-[15px] text-ink-2">Every wall is a shop. Artists hang a code, we print and ship, they get paid.</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--af-scan)]" checked={showSensitive} onChange={(e) => setShowSensitive(e.target.checked)} />
            Show sensitive art without blur
          </label>
        </div>
        {COLS.map(([title, links]) => (
          <div key={title} className="grid content-start gap-2">
            <b className="text-sm">{title}</b>
            {links.map(([label, href]) => <Link key={href} href={href} className="text-[15px] text-ink-2 no-underline hover:text-ink">{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-[1240px] px-4 pb-8 text-[13px] text-ink-2 sm:px-6">© {new Date().getFullYear()} Artfinity</div>
    </footer>
  );
}
