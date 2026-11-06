// Under the buyer's Pay button: four short lines that answer "is this safe, how can I pay, what if it arrives
// broken, who gets the money". Numbers come from the code that enforces them.
import Link from "next/link";
import { Heart, Lock, RotateCcw, Smartphone } from "lucide-react";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";
import { FREE_SPLIT, pct } from "@/lib/plans";

export default function TrustStrip({ artist }: { artist?: string }) {
  const rows = [
    { icon: Lock, text: <>Secure payment by Stripe</> },
    { icon: Smartphone, text: <>Apple Pay, Google Pay or card</> },
    { icon: RotateCcw, text: <>Arrives damaged? Free reprint within {HELP_DAYS_AFTER_DELIVERY} days. <Link href="/return-policy" className="font-semibold text-ink underline underline-offset-2">Returns</Link></> },
    { icon: Heart, text: <>{artist && artist !== "the artist" ? artist : "The artist"} {artist?.includes(" and ") ? "get" : "gets"} at least {pct(FREE_SPLIT)} of the profit</> },
  ];
  return (
    <ul className="grid gap-1.5 text-[13px] leading-snug text-ink-2" aria-label="Paying safely">
      {rows.map(({ icon: Icon, text }, i) => (
        <li key={i} className="flex items-start gap-2">
          <Icon className="mt-[2px] h-3.5 w-3.5 shrink-0 text-ink" aria-hidden="true" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
