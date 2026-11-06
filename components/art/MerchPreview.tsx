// "Coming soon" merch row on the buy page: the same artwork on a tote, mug, tee and magnet.
// Pure SVG mockups built from the artwork image, so it needs no extra files or data.
import { useId } from "react";

type Props = { imageUrl: string; title: string; artistFirstName: string };

const CARD = "grid content-start gap-2";
const LABEL = "text-[14px] font-bold leading-tight";
const SUB = "text-[13px] text-ink-2";

function Tote({ src, id }: { src: string; id: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <rect width="200" height="200" fill="var(--af-wall)" />
      <path d="M72 62 C72 28 128 28 128 62" fill="none" stroke="#c9b48f" strokeWidth="7" strokeLinecap="round" />
      <path d="M50 62 H150 L158 176 Q158 182 152 182 H48 Q42 182 42 176 Z" fill="#efe4cf" stroke="#d8c8a8" strokeWidth="1.5" />
      <clipPath id={`${id}-tote`}><rect x="68" y="86" width="64" height="76" rx="2" /></clipPath>
      <image href={src} x="68" y="86" width="64" height="76" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-tote)`} />
      <path d="M50 62 H150 L151 74 H49 Z" fill="#000" opacity="0.06" />
    </svg>
  );
}

function Mug({ src, id }: { src: string; id: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <rect width="200" height="200" fill="var(--af-gallery)" />
      <ellipse cx="96" cy="166" rx="56" ry="8" fill="#000" opacity="0.1" />
      <path d="M146 82 C178 82 178 136 146 136" fill="none" stroke="#fff" strokeWidth="12" />
      <path d="M146 82 C178 82 178 136 146 136" fill="none" stroke="#000" strokeOpacity="0.08" strokeWidth="12" />
      <rect x="44" y="58" width="104" height="106" rx="10" fill="#fff" />
      <clipPath id={`${id}-mug`}><rect x="56" y="74" width="80" height="74" rx="3" /></clipPath>
      <image href={src} x="56" y="74" width="80" height="74" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-mug)`} />
      <linearGradient id={`${id}-shade`} x1="0" x2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.14" />
        <stop offset="0.35" stopColor="#000" stopOpacity="0" />
        <stop offset="0.8" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.16" />
      </linearGradient>
      <rect x="44" y="58" width="104" height="106" rx="10" fill={`url(#${id}-shade)`} />
      <ellipse cx="96" cy="60" rx="52" ry="5" fill="#e9e9e9" />
    </svg>
  );
}

function Tee({ src, id }: { src: string; id: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <rect width="200" height="200" fill="#dfe3ea" />
      <path
        d="M70 34 Q100 50 130 34 L170 54 L158 86 L142 80 L142 180 H58 L58 80 L42 86 L30 54 Z"
        fill="#fbfbf8"
        stroke="#d6d6d0"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M86 38 Q100 50 114 38" fill="none" stroke="#d6d6d0" strokeWidth="2" />
      <clipPath id={`${id}-tee`}><rect x="76" y="70" width="48" height="58" rx="1" /></clipPath>
      <image href={src} x="76" y="70" width="48" height="58" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-tee)`} />
    </svg>
  );
}

function Magnet({ src, id }: { src: string; id: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <rect width="200" height="200" fill="#e8ebee" />
      <rect x="62" y="56" width="76" height="92" rx="6" fill="#000" opacity="0.12" transform="translate(3 5)" />
      <g transform="rotate(-4 100 102)">
        <rect x="62" y="56" width="76" height="92" rx="6" fill="#fff" />
        <clipPath id={`${id}-mag`}><rect x="67" y="61" width="66" height="82" rx="3" /></clipPath>
        <image href={src} x="67" y="61" width="66" height="82" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id}-mag)`} />
      </g>
    </svg>
  );
}

const ITEMS = [
  { key: "tote", name: "Tote bag", sub: "Heavy cotton", Art: Tote },
  { key: "mug", name: "Mug", sub: "11 oz ceramic", Art: Mug },
  { key: "tee", name: "T-shirt", sub: "Soft cotton tee", Art: Tee },
  { key: "magnet", name: "Magnet", sub: "Fridge size", Art: Magnet },
] as const;

export default function MerchPreview({ imageUrl, title, artistFirstName }: Props) {
  const id = useId().replace(/:/g, "");
  return (
    <section aria-labelledby={`${id}-h`} className="mx-auto mt-10 max-w-[1240px] border-t border-line px-4 pt-8 sm:px-6 md:mt-16 md:pt-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="display text-[30px] md:text-[40px]">More ways to keep it</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            <i>{title}</i> on everyday things. {artistFirstName} earns on these too.
          </p>
        </div>
        <span className="sticker-badge">Coming soon</span>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {ITEMS.map(({ key, name, sub, Art }) => (
          <li key={key} className={CARD}>
            <div className="aspect-square overflow-hidden rounded-2xl border border-line">
              <Art src={imageUrl} id={`${id}-${key}`} />
            </div>
            <div>
              <p className={LABEL}>{name}</p>
              <p className={SUB}>{sub}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
