"use client";

import { usePathname } from "next/navigation";
import QRCode from "@/components/af/QRCode";

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .43  0 0 0 0 .38  0 0 0 .16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const dab = (r: string) => ({ borderRadius: r });

// A gallery wall behind the auth card: canvas grain, a wash of paint, and on the
// smaller screens (login, password) a framed painting hung with its QR label.
// Purely decorative.
export default function WallBackdrop() {
  const path = usePathname() || "";
  const register = path.startsWith("/register");
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 opacity-50 mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      <svg className="absolute -left-[10%] bottom-[4%] h-[160px] w-[120%] text-gallery sm:h-[240px]" viewBox="0 0 300 40" preserveAspectRatio="none">
        <use href="#af-stroke" />
      </svg>

      {!register && (
        <>
          {/* hung painting + its little label, the whole idea in one picture */}
          <div className="absolute left-[max(32px,calc(50%-600px))] top-[170px] hidden items-end gap-4 xl:flex">
            <div className="w-[210px] rotate-[-1.5deg] border-[10px] border-ink bg-paper p-3 shadow-[0_18px_30px_rgba(21,22,27,.22)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/seed/art-01.jpg" alt="" className="block aspect-[4/5] w-full object-cover" />
            </div>
            <div className="mb-6 grid w-[86px] rotate-[2deg] gap-1 rounded-md bg-paper p-2 shadow-[0_6px_14px_rgba(21,22,27,.16)]">
              <QRCode value="https://theartfinity.com" dots="rounded" eyes="frame" eyeColor="#8b2a4b" />
              <span className="text-center text-[9.5px] font-bold leading-tight text-ink">Buy a print</span>
            </div>
          </div>
          {/* the same picture, smaller, low on the wall on phones and tablets */}
          <div className="absolute bottom-[56px] left-1/2 flex -translate-x-1/2 items-end gap-3 xl:hidden">
            <div className="w-[118px] rotate-[-1.5deg] border-[6px] border-ink bg-paper p-2 shadow-[0_12px_22px_rgba(21,22,27,.2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/seed/art-01.jpg" alt="" className="block aspect-[4/5] w-full object-cover" />
            </div>
            <div className="mb-3 grid w-[58px] rotate-[2deg] gap-0.5 rounded bg-paper p-1.5 shadow-[0_5px_12px_rgba(21,22,27,.16)]">
              <QRCode value="https://theartfinity.com" dots="rounded" eyes="frame" eyeColor="#8b2a4b" />
              <span className="text-center text-[7.5px] font-bold leading-tight text-ink">Buy a print</span>
            </div>
          </div>
          <span className="absolute right-[max(32px,calc(50%-560px))] top-[22%] hidden h-24 w-28 rotate-[-14deg] bg-sticker opacity-80 sm:block" style={dab("52% 44% 58% 40%")} />
          <span className="absolute right-[max(64px,calc(50%-520px))] top-[30%] hidden h-10 w-12 rotate-[22deg] bg-scan opacity-90 sm:block" style={dab("46% 58% 40% 52%")} />
        </>
      )}
      {register && (
        <span className="absolute bottom-[14%] left-[max(16px,calc(50%-660px))] hidden h-16 w-20 rotate-[-10deg] bg-sticker opacity-70 xl:block" style={dab("52% 44% 58% 40%")} />
      )}
    </div>
  );
}
