// Average rating as five paint dabs (partly filled for the fraction) plus "4.8 · 23 reviews".
// Works in server and client components. Renders nothing when there are no reviews, unless `empty` is given.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ratingLabel } from "./format";

const SIZES = {
  sm: { dab: "h-3 w-3", gap: "gap-[3px]", text: "text-[13px]" },
  md: { dab: "h-4 w-4", gap: "gap-1", text: "text-[14.5px]" },
  lg: { dab: "h-5 w-5", gap: "gap-1", text: "text-[17px]" },
} as const;

/** Five dabs showing a 0-5 value; fractions fill part of a dab. */
export function Dabs({ value, size = "md", color = "var(--af-sticker)", className }: { value: number; size?: keyof typeof SIZES; color?: string; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i)) * 100;
        return (
          <i
            key={i}
            className={cn("paint-dab ring-1 ring-inset ring-ink/15", s.dab)}
            style={{ background: `linear-gradient(90deg, ${color} ${fill}%, var(--af-line) ${fill}%)`, transform: `rotate(${[-14, 8, -6, 12, -10][i]}deg)` }}
          />
        );
      })}
    </span>
  );
}

export default function ReviewStars({
  average,
  count,
  size = "md",
  href,
  empty,
  className,
}: {
  average: number;
  count: number;
  size?: keyof typeof SIZES;
  /** Wraps it in a link, e.g. "#reviews" to jump to the list. */
  href?: string;
  /** Text to show when count is 0 (e.g. "No reviews yet"). Omit to render nothing. */
  empty?: string;
  className?: string;
}) {
  const s = SIZES[size];
  if (!count) return empty ? <span className={cn("text-ink-2", s.text, className)}>{empty}</span> : null;
  const label = `Rated ${ratingLabel(average)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`;
  const inner = (
    <>
      <Dabs value={average} size={size} />
      <b className="num font-bold text-ink">{ratingLabel(average)}</b>
      <span className="text-ink-2">· {count} {count === 1 ? "review" : "reviews"}</span>
    </>
  );
  const cls = cn("inline-flex items-center gap-1.5 whitespace-nowrap", s.text, className);
  const linkCls = cn(cls, "no-underline hover:[&>span:last-child]:text-ink");
  // A plain <a> for "#reviews" so the browser fires hashchange (tabs listen for it); next/link pushes state silently.
  return href ? (
    href.startsWith("#") ? <a href={href} aria-label={label} className={linkCls}>{inner}</a> : <Link href={href} aria-label={label} className={linkCls}>{inner}</Link>
  ) : (
    <span role="img" aria-label={label} className={cls}>{inner}</span>
  );
}
