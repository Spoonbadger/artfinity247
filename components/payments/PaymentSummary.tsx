// The one payment summary for every payment in Artfinity: what you're paying for, the totals, the tax line, then the
// Pay button (children). Used by buyer checkout, printed codes, bulk prints, painting scans and the Infinity plan.
// No hooks, so it renders on the server or inside a client component. Put a <PayButton> (or StartInfinityButton,
// ScanPayButton) in `children`; notes go under it.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { money } from "./money";

export type PayLine = {
  key: string;
  title: ReactNode;
  /** Size, frame, "× 3", what it covers. */
  detail?: ReactNode;
  imageUrl?: string | null;
  amountCents: number;
  /** Price before a discount, shown struck through. */
  wasCents?: number | null;
};

export type PayRow = {
  label: ReactNode;
  /** A negative number shows as "−$5.00" (discounts). */
  cents?: number;
  /** Instead of an amount: "Free", "Added at payment". */
  text?: ReactNode;
};

/**
 * Sales tax, said plainly:
 *   "added"  Stripe adds it on its page from the address (Stripe Tax, lib/tax.ts). The total reads "before tax".
 *   "none"   this payment isn't taxed.
 *   "test"   test mode: nothing is charged, so no tax either.
 *   number   known tax in cents (receipts, the thank-you page).
 */
export type TaxLine = "added" | "none" | "test" | number;

export default function PaymentSummary({
  title = "Summary", headingLevel = 2, lines = [], rows = [], tax, totalCents, totalLabel, children, footer, className, id,
}: {
  title?: ReactNode;
  headingLevel?: 2 | 3;
  lines?: PayLine[];
  rows?: PayRow[];
  tax?: TaxLine;
  totalCents: number;
  /** Defaults to "Total" ("Total before tax" when tax is added at payment). */
  totalLabel?: ReactNode;
  /** The Pay button and anything that belongs right next to it. */
  children?: ReactNode;
  /** Small print under everything. */
  footer?: ReactNode;
  className?: string;
  id?: string;
}) {
  const H = headingLevel === 3 ? "h3" : "h2";
  const taxRow: PayRow | null =
    tax === undefined ? null
      : tax === "added" ? { label: "Sales tax", text: "Added at payment" }
        : tax === "none" ? { label: "Sales tax", text: "None" }
          : tax === "test" ? { label: "Sales tax", text: "None in test mode" }
            : { label: "Sales tax", cents: tax };
  const all = taxRow ? [...rows, taxRow] : rows;
  const label = totalLabel ?? (tax === "added" ? "Total before tax" : "Total");

  return (
    <section id={id} aria-label={typeof title === "string" ? title : "Payment summary"} className={cn("grid w-full content-start gap-3 rounded-2xl border-[1.5px] border-ink bg-white p-4 sm:p-5", className)}>
      {title && <H className="text-[20px] font-extrabold leading-tight">{title}</H>}

      {lines.length > 0 && (
        <ul className="grid divide-y divide-line">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-3 py-2.5 first:pt-0">
              {l.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.imageUrl} alt="" className="h-14 w-11 shrink-0 rounded-[2px] bg-wall object-cover shadow-[0_4px_10px_-4px_rgba(21,22,27,.4)]" />
              )}
              <div className="min-w-0 flex-1 leading-tight">
                <b className="block truncate text-[15px]">{l.title}</b>
                {l.detail && <span className="block text-[13px] text-ink-2">{l.detail}</span>}
              </div>
              <span className="num shrink-0 text-right leading-tight">
                <b className="block text-[15px]">{money(l.amountCents)}</b>
                {l.wasCents && l.wasCents > l.amountCents ? <s className="text-[12.5px] text-ink-2">{money(l.wasCents)}</s> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <dl className={cn("num grid gap-1.5 text-[14.5px]", lines.length > 0 && "border-t border-line pt-3")}>
        {all.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-2">{r.label}</dt>
            <dd className="text-right">{r.text ?? (r.cents != null ? (r.cents < 0 ? `−${money(-r.cents)}` : money(r.cents)) : null)}</dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <dt className="font-bold">{label}</dt>
          <dd className="font-display text-[30px] font-extrabold leading-none [font-variation-settings:'wdth'_80]">{money(totalCents)}</dd>
        </div>
      </dl>

      {children && <div className="grid gap-2">{children}</div>}
      {footer && <div className="text-[12.5px] leading-snug text-ink-2">{footer}</div>}
    </section>
  );
}
