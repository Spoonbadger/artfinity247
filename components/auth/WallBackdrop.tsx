// A gallery wall behind the auth card: faint canvas grain and a couple of loose paint marks.
// Purely decorative.
export default function WallBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* canvas grain */}
      <div
        className="absolute inset-0 opacity-[0.5] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .43  0 0 0 0 .38  0 0 0 .16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      {/* wide wash of paint low on the wall */}
      <svg className="absolute -left-[10%] bottom-[6%] h-[180px] w-[120%] text-gallery sm:h-[260px]" viewBox="0 0 300 40" preserveAspectRatio="none">
        <use href="#af-stroke" />
      </svg>
      {/* a sticker-yellow dab and a blue dab, like test marks on a studio wall */}
      <span className="absolute right-[7%] top-[18%] hidden h-24 w-28 rotate-[-14deg] bg-sticker opacity-80 sm:block" style={{ borderRadius: "52% 44% 58% 40%" }} />
      <span className="absolute right-[12%] top-[26%] hidden h-10 w-12 rotate-[22deg] bg-scan opacity-90 sm:block" style={{ borderRadius: "46% 58% 40% 52%" }} />
      <span className="absolute left-[6%] top-[58%] hidden h-14 w-16 rotate-[8deg] bg-coral opacity-70 lg:block" style={{ borderRadius: "58% 40% 52% 44%" }} />
    </div>
  );
}
