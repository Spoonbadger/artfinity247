"use client";

import Link from "next/link";
import Logo from "@/components/af/Logo";
import { useSensitivePref } from "@/components/site/useSensitivePref";
import AppConfigs from "@/db/json/AppConfigs.json";

// Contact facts come from the same config the original footer used.
const EMAIL = AppConfigs.business_email;
const ADDRESS = AppConfigs.business_address.replace(/,\s*United States$/, "").replace(/, (\d{5})/, " $1");
const HOURS = "Weekdays " + AppConfigs.business_open_time.split("\n")[0].trim().replace(/\s*-\s*/, " to ");

const COLS: [string, [string, string][]][] = [
  ["For artists", [["Start selling free", "/register"], ["How it works", "/#how"], ["Sell with us", "/sell-with-us"], ["Pricing", "/pricing"], ["Artist help", "/help/getting-started"], ["For developers", "/developers"], ["Artist terms", "/artist-terms-and-agreement"]]],
  ["For collectors", [["Browse art", "/art"], ["Your orders", "/collector"], ["Artists", "/artists"], ["Scenes by neighborhood", "/scenes"], ["Buying help", "/help/buyers"], ["Returns", "/return-policy"]]],
  ["Artfinity", [["About", "/about-us"], ["Help center", "/help"], ["Contact", "/contact"], ["Privacy", "/privacy-policy"], ["Terms", "/terms-and-conditions"], ["Cookie Policy", "/cookie-policy"], ["Report art", "/report"], ["DMCA", "/dmca"], ["Accessibility", "/accessibility"]]],
];

export default function SiteFooter() {
  const [showSensitive, setShowSensitive] = useSensitivePref();
  return (
    <footer className="border-t border-line bg-wall">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-x-6 gap-y-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_repeat(3,1fr)] md:gap-10">
        <div className="col-span-2 grid content-start gap-3 md:col-span-1">
          <Logo />
          <p className="max-w-[30ch] text-[15px] text-ink-2">Every wall is a shop. Artists hang a code, we print and ship, they get paid.</p>
          <label className="mt-1 inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm font-semibold text-ink">
            <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--af-scan)]" checked={showSensitive} onChange={(e) => setShowSensitive(e.target.checked)} />
            Show sensitive art without blur
          </label>
        </div>
        {COLS.map(([title, links]) => (
          <div key={title} className="grid content-start gap-0 md:gap-2">
            <b className="mb-1 text-sm md:mb-0">{title}</b>
            {links.map(([label, href]) => <Link key={href} href={href} className="py-2.5 text-[15px] text-ink-2 no-underline hover:text-ink md:py-0">{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap gap-x-2 gap-y-1 px-4 pb-8 text-[13px] text-ink-2 sm:px-6">
        <span>© {new Date().getFullYear()} Artfinity</span>
        <span aria-hidden="true">·</span>
        <a href={`mailto:${EMAIL}`} className="font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">{EMAIL}</a>
        <span aria-hidden="true">·</span>
        <span>{ADDRESS}</span>
        <span aria-hidden="true">·</span>
        <span>{HOURS}, closed weekends and holidays</span>
      </div>
    </footer>
  );
}
