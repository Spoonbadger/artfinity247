"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/orders", label: "Orders", dab: "var(--af-scan)" },
  { href: "/admin/moderation", label: "Moderation", dab: "var(--af-coral)" },
  { href: "/admin/payouts", label: "Payouts", dab: "var(--af-earned)" },
  { href: "/admin/verification", label: "Verification", dab: "var(--af-sticker)" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
      {LINKS.map((l) => {
        const on = pathname?.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={on ? "page" : undefined}
            className="relative z-0 flex items-center gap-2 whitespace-nowrap px-3 py-2 text-[15px] font-semibold text-ink no-underline"
          >
            {on && <BrushStroke className="absolute inset-x-0 top-1/2 -z-10 h-7 w-full -translate-y-1/2" color="var(--af-sticker)" />}
            <span className="paint-dab" style={{ ["--dab" as string]: l.dab }} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
