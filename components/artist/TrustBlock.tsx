import Medal, { medalLabel } from "@/components/af/Medal";
import VerifiedBadge, { verifiedText } from "@/components/af/VerifiedBadge";
import type { Trust } from "@/lib/artistTrust";

/** Name-line badges: verified seal, then medal. Sized for big headings. */
export function NameBadges({ trust, size = 30 }: { trust: Trust; size?: number }) {
  if (!trust.verified && !trust.medal) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 self-center">
      {trust.verified && <VerifiedBadge size={size} verifiedAt={trust.verifiedAt} />}
      {trust.medal && <Medal tier={trust.medal} size={size + 4} />}
    </span>
  );
}

/** Small badges for cards and inline artist names. */
export function InlineBadges({ trust, size = 16, className }: { trust?: Trust | null; size?: number; className?: string }) {
  if (!trust || (!trust.verified && !trust.medal)) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className ?? ""}`}>
      {trust.verified && <VerifiedBadge size={size} verifiedAt={trust.verifiedAt} />}
      {trust.medal && <Medal tier={trust.medal} size={size + 2} />}
    </span>
  );
}

/** Artist page side block: the large medal and verification, spelled out for people on phones (no hover tooltips). */
export default function TrustBlock({ trust }: { trust: Trust }) {
  if (!trust.verified && !trust.medal) return null;
  const when = trust.verifiedAt ? new Date(trust.verifiedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
  return (
    <ul className="grid gap-3" aria-label="Trust">
      {trust.medal && (
        <li className="flex items-center gap-3">
          <Medal tier={trust.medal} size={56} />
          <span className="grid leading-tight">
            <b className="text-[15.5px] text-ink">{medalLabel(trust.medal).name}</b>
            <span className="num text-[13.5px] text-ink-2">{trust.printsSold.toLocaleString("en-US")} prints sold</span>
          </span>
        </li>
      )}
      {trust.verified && (
        <li className="flex items-center gap-3" title={verifiedText(trust.verifiedAt)}>
          <span className="grid w-14 place-items-center">
            <VerifiedBadge size={44} verifiedAt={trust.verifiedAt} />
          </span>
          <span className="grid leading-tight">
            <b className="text-[15.5px] text-ink">Verified artist</b>
            <span className="text-[13.5px] text-ink-2">Checked by Artfinity{when ? ` · ${when}` : ""}</span>
          </span>
        </li>
      )}
    </ul>
  );
}
