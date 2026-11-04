import { cn } from "@/lib/utils";

/**
 * Verified artist: a scan-blue wax-seal with a brushed white tick.
 * Only for Artist.verification === "VERIFIED" (a person at Artfinity checked it).
 *   <VerifiedBadge />                        inline, 18px
 *   <VerifiedBadge size={22} showLabel />    seal + "Verified" chip
 */

function seal(cx: number, cy: number, r: number, amp: number, n: number) {
  const pt = (a: number, rad: number) => `${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
  let d = `M${pt(-Math.PI / 2, r)}`;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
    d += `Q${pt((a0 + a1) / 2, r + amp * 2)} ${pt(a1, r)}`;
  }
  return d + "Z";
}

const SEAL = seal(24, 24, 18.5, 1.9, 12);

export function verifiedText(verifiedAt?: string | Date | null) {
  const d = verifiedAt ? new Date(verifiedAt) : null;
  const when = d && !isNaN(+d) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  return `Verified artist · checked by Artfinity${when ? ` on ${when}` : ""}`;
}

export function VerifiedMark({ size = 18, className }: { size?: number; className?: string }) {
  const detailed = size >= 28;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={cn("inline-block shrink-0 align-middle", className)} aria-hidden="true" focusable="false">
      <path d={SEAL} fill="var(--af-scan, #2b37f0)" />
      {detailed && <circle cx="24" cy="24" r="14.2" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="1.5 2.4" />}
      {detailed && <path d="M13.5 17.5c1.7-3.4 5-5.9 8.9-6.4" stroke="#fff" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" fill="none" />}
      <path d="M15.2 24.8l6 6.1 12.4-13.6" fill="none" stroke="#fff" strokeWidth={detailed ? 4.4 : 5.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function VerifiedBadge({
  size = 18,
  showLabel = false,
  verifiedAt,
  className,
}: {
  size?: number;
  showLabel?: boolean;
  verifiedAt?: string | Date | null;
  className?: string;
}) {
  const text = verifiedText(verifiedAt);
  if (showLabel) {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 rounded-full bg-scan-soft py-0.5 pl-1 pr-2.5 font-body text-[12.5px] font-bold tracking-normal text-scan [font-variation-settings:normal]", className)}
        title={text}
      >
        <VerifiedMark size={size} />
        <span>Verified</span>
        <span className="sr-only"> artist, checked by Artfinity</span>
      </span>
    );
  }
  return (
    <span role="img" aria-label={text} title={text} className={cn("inline-flex shrink-0", className)}>
      <VerifiedMark size={size} />
    </span>
  );
}
