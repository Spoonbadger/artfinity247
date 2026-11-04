import type { Edition } from "@/lib/editionFormat";
import { cn } from "@/lib/utils";

/** "Edition of 25 · 7 left" chip for limited print runs. Renders nothing for open editions. */
export default function EditionBadge({ edition, className, compact = false }: { edition?: Edition | null; className?: string; compact?: boolean }) {
  if (!edition) return null;
  const { size, left, soldOut, lastFew } = edition;
  const label = soldOut ? "Sold out" : lastFew ? `Last few · ${left} left` : compact ? (left === size ? `Edition of ${size}` : `${left} of ${size} left`) : `Edition of ${size} · ${left} left`;
  return (
    <span
      className={cn(
        "num inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full font-bold leading-none",
        compact ? "px-2 py-1 text-[11.5px]" : "px-3 py-1.5 text-[13.5px]",
        soldOut ? "bg-ink text-white" : lastFew ? "bg-coral text-white" : "bg-sticker text-ink",
        className,
      )}
      title={`Limited edition of ${size} prints`}
    >
      <svg viewBox="0 0 12 12" className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden="true">
        <rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="4" y="4" width="4" height="4" fill="currentColor" />
      </svg>
      {label}
      {soldOut && !compact && <span className="font-semibold opacity-75">· edition of {size}</span>}
    </span>
  );
}
