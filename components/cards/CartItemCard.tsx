"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useCart } from "@/components/contexts";
import SensitiveImage from "@/components/site/SensitiveImage";
import { CartItemType } from "@/types";
import { cn } from "@/lib/utils";
import { artPath } from "@/lib/urls";
import { usd } from "@/components/art/pricing";
import { sizeText } from "@/components/art/checkout";

const MAX_QTY = 10;

/** One cart line: art, size, frame, scan deal, quantity and price. Set `readOnly` for order summaries. */
const CartItemCard = ({ item, className, readOnly = false }: { item: CartItemType; className?: string; readOnly?: boolean }): ReactNode => {
  const { updateToCart, removeFromCart } = useCart();
  const p = item.product as CartItemType["product"] & { listPrice?: number; discountPct?: number; venue?: string | null; sensitive?: string[]; handle?: string };
  // Older cart items have no handle; their /art/<slug> link redirects.
  const href = p.handle ? artPath(p.handle, p.slug) : `/art/${encodeURIComponent(p.slug)}`;
  const q = item.quantity;
  const setQ = (n: number) => updateToCart(item.product, Math.max(1, Math.min(MAX_QTY, n)));

  return (
    <div className={cn("grid grid-cols-[76px_minmax(0,1fr)_auto] items-start gap-3 py-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-4", className)}>
      <Link href={href} className="block overflow-hidden rounded-[3px] bg-white p-1 shadow-[0_6px_14px_-6px_rgba(21,22,27,.45)]">
        <SensitiveImage labels={p.sensitive}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.imageUrl || ""} alt={p.title} className="aspect-[4/5] w-full object-cover" />
        </SensitiveImage>
      </Link>

      <div className="grid min-w-0 gap-0.5">
        <Link href={href} className="truncate text-[16px] font-bold text-ink no-underline hover:underline">{p.title}</Link>
        {p.artist && <span className="truncate text-[13px] text-ink-2">{p.artist}</span>}
        <span className="text-[13.5px]">
          {sizeText(p.selectedSize)}
          {p.frameChosen ? ` · ${p.frameColor ?? ""} frame`.replace("natural", "natural wood") : ""}
        </span>
        {!!p.discountPct && (
          <span className="mt-1 w-fit -rotate-1 rounded-full bg-sticker px-2 py-0.5 text-[12px] font-bold">
            {p.discountPct}% off{p.venue ? ` · ${p.venue}` : ""}
          </span>
        )}
        {!readOnly && (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center rounded-full border-2 border-ink">
              <button type="button" onClick={() => setQ(q - 1)} disabled={q <= 1} aria-label={`One fewer ${p.title}`} className="grid h-10 w-11 place-items-center rounded-full disabled:opacity-30">
                <Minus className="h-4 w-4" />
              </button>
              <span className="num w-6 text-center text-[15px] font-bold" aria-live="polite" aria-label={`Quantity ${q}`}>{q}</span>
              <button type="button" onClick={() => setQ(q + 1)} disabled={q >= MAX_QTY} aria-label={`One more ${p.title}`} className="grid h-10 w-11 place-items-center rounded-full disabled:opacity-30">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button type="button" onClick={() => removeFromCart(item.product)} className="min-h-[44px] px-1 text-[14px] font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="num text-right leading-tight">
        <b className="block text-[16px]">{usd(p.unitPrice * q)}</b>
        {p.listPrice && p.listPrice > p.unitPrice ? <s className="text-[13px] text-ink-2">{usd(p.listPrice * q)}</s> : null}
        {readOnly && q > 1 && <span className="block text-[12.5px] text-ink-2">{q} × {usd(p.unitPrice)}</span>}
      </div>
    </div>
  );
};

export default CartItemCard;
