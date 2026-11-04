import Image from "next/image";

/**
 * A wide crop of the artist's own best piece, softened into a painterly band:
 * scaled up past the frame, a canvas-grain overlay, and a brushed bottom edge
 * that bleeds into the page.
 */
export default function ArtistBanner({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative h-[168px] overflow-hidden bg-gallery sm:h-[240px] lg:h-[300px]">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="scale-[1.04] object-cover [filter:saturate(1.08)_contrast(1.02)]"
          style={{ objectPosition: "50% 36%" }}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_20%_10%,#f7c8a8,transparent_60%),radial-gradient(90%_80%_at_85%_30%,#b8c4ff,transparent_60%),#e9e6df]" />
      )}

      {/* canvas grain */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22] mix-blend-multiply" aria-hidden="true">
        <filter id="af-canvas-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.32  0 0 0 0 0.28  0 0 0 0.9 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#af-canvas-grain)" />
      </svg>

      {/* a soft vignette toward the bottom so the name reads */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/10 to-transparent" />

      {/* brushed bottom edge */}
      <svg
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[26px] w-full text-white sm:h-[38px]"
        viewBox="0 0 1440 40"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M0 22C80 14 150 26 240 20S390 8 480 17 640 30 760 21 930 9 1040 18 1220 30 1320 19 1410 14 1440 16V40H0Z"
        />
        <path
          fill="currentColor"
          opacity=".55"
          d="M0 17C120 10 210 21 330 15S520 6 640 13 840 24 980 15 1180 6 1300 13 1420 18 1440 12V40H0Z"
        />
        <path
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity=".5"
          strokeLinecap="round"
          d="M60 13C200 7 330 16 470 11M760 15C900 9 1030 14 1180 9"
        />
      </svg>
    </div>
  );
}
