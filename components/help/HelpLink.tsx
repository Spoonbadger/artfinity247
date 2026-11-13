import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small "Help" link from a Studio page to its help article, e.g. <HelpLink href="/help/qr-codes/qr-templates" />. */
export default function HelpLink({ href, label = "Help", className }: { href: string; label?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-semibold text-ink-2 no-underline hover:bg-wall hover:text-ink", className)}>
      <CircleHelp className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
