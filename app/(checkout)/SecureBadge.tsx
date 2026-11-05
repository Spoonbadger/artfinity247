"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";

/** "Secure checkout" while paying; gone once they've paid (thank-you) or backed out (cancel). */
export default function SecureBadge() {
  const path = usePathname() || "";
  if (path.startsWith("/thank-you") || path.startsWith("/cancel")) return null;
  return (
    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-2">
      <Lock className="h-3.5 w-3.5" aria-hidden /> Secure checkout
    </span>
  );
}
