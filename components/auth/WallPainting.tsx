"use client";

import { usePathname } from "next/navigation";
import QRCode from "@/components/af/QRCode";

// Phones and tablets: the hung painting and its QR label, below the auth card in the page flow
// (not behind it), so a taller card never covers it. Wide screens show it beside the card (WallBackdrop).
// Purely decorative.
export default function WallPainting() {
  const path = usePathname() || "";
  if (path.startsWith("/register")) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none relative z-0 -mt-6 flex items-end justify-center gap-3 pb-16 min-[1360px]:hidden">
      <div className="w-[118px] rotate-[-1.5deg] border-[6px] border-ink bg-paper p-2 shadow-[0_12px_22px_rgba(21,22,27,.2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/seed/art-01.jpg" alt="" className="block aspect-[4/5] w-full object-cover" />
      </div>
      <div className="mb-3 grid w-[58px] rotate-[2deg] gap-0.5 rounded bg-paper p-1.5 shadow-[0_5px_12px_rgba(21,22,27,.16)]">
        <QRCode value="https://theartfinity.com" dots="rounded" eyes="frame" eyeColor="#8b2a4b" />
        <span className="text-center text-[7.5px] font-bold leading-tight text-ink">Buy a print</span>
      </div>
    </div>
  );
}
