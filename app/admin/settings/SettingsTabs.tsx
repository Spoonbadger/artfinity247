"use client";
// Tabs across every settings page, so Settings is one place in the menu.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PAINTING_SCANS } from "@/lib/features";

const TABS = [
  { href: "/admin/settings", label: "General", owner: true },
  { href: "/admin/settings/auto-approval", label: "Auto-approval", owner: true },
  { href: "/admin/settings/notifications", label: "Alert emails" },
  { href: "/admin/settings/rewards", label: "Collector rewards" },
  ...(PAINTING_SCANS ? [{ href: "/admin/settings/scanning", label: "Scanning service" }] : []),
  { href: "/admin/settings/code-prints", label: "Code print prices" },
];

export default function SettingsTabs({ owner }: { owner: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="flex flex-wrap gap-1.5">
      {TABS.filter((t) => owner || !t.owner).map((t) => {
        const on = pathname === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={cn("inline-flex min-h-[40px] items-center rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold no-underline", on ? "border-ink bg-ink text-white" : "border-edge-strong bg-white text-ink hover:border-ink")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
