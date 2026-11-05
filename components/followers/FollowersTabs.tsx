import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/studio/followers", label: "Followers" },
  { href: "/studio/newsletter", label: "Newsletter" },
];

/** Followers | Newsletter, shared by both Studio pages. */
export default function FollowersTabs({ active }: { active: "/studio/followers" | "/studio/newsletter" }) {
  return (
    <nav aria-label="Followers" className="-mt-2 flex gap-1 border-b border-line">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={cn(
            "-mb-px min-h-[44px] border-b-[3px] px-3 py-2.5 text-[15px] font-semibold no-underline",
            t.href === active ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
