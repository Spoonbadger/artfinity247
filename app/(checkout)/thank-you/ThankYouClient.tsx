"use client";

import { useEffect, useRef, useState } from "react";
import { orderCode } from "@/lib/orderText";
import Link from "next/link";
import { useCart } from "@/components/contexts";
import { BrushStroke } from "@/components/af/Brush";
import { usd } from "@/components/art/pricing";
import { editionLabel } from "@/lib/editionFormat";
import { deliveryRange } from "@/lib/delivery";

type OrderItem = {
  id: string;
  title: string | null;
  slug: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl?: string | null;
  frameChosen?: boolean;
  frameColor?: string | null;
  editionNumber?: number | null;
  /** Signed link to the printable certificate of authenticity (limited editions only). */
  certPath?: string | null;
  artwork?: { imageUrl?: string | null; title?: string | null; slug?: string | null; editionSize?: number | null; artist?: { name?: string | null; slug?: string | null } | null } | null;
};
type Order = {
  id: string;
  createdAt: string;
  email: string | null;
  amountTotal: number;
  paymentStatus: string | null;
  receiptSentAt?: string | null;
  shippingName?: string | null;
  shippingAddress?: string | null;
  /** Signed /order/<id>/help link, once the order has shipped. */
  helpPath?: string | null;
  items: OrderItem[];
};

const SIZE: Record<string, { key: string; label: string }> = {
  S: { key: "small", label: "Small · 5 × 7 in" },
  M: { key: "medium", label: "Medium · 8 × 12 in" },
  L: { key: "large", label: "Large · 11 × 17 in" },
  XL: { key: "xl", label: "XL · 18 × 24 in" },
};
const sizeOf = (s: string | null) => SIZE[(s || "").toUpperCase()] ?? Object.values(SIZE).find((v) => v.key === s) ?? { key: s || "", label: s || "" };

export default function ThankYouClient({ sessionId }: { sessionId: string }) {
  const { cartItems, removeFromCart } = useCart();
  const cleared = useRef(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!sessionId) { setState("missing"); return; }
    let stop = false;
    (async () => {
      // the Stripe webhook can land a few seconds after the redirect
      for (let i = 0; i < 5 && !stop; i++) {
        const res = await fetch(`/api/thank-you?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" }).catch(() => null);
        if (res?.ok) { setOrder(await res.json()); setState("ok"); return; }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!stop) setState("missing");
    })();
    return () => { stop = true; };
  }, [sessionId]);

  // Take what was bought out of the cart (leave anything else they saved)
  useEffect(() => {
    if (!order || cleared.current || order.paymentStatus !== "paid" || !cartItems.length) return;
    cleared.current = true;
    for (const ci of cartItems) {
      const p = ci.product;
      const bought = order.items.some(
        (it) => it.slug === p.slug && sizeOf(it.size).key === p.selectedSize && !!it.frameChosen === !!p.frameChosen && (it.frameColor ?? null) === (p.frameColor ?? null),
      );
      if (bought) removeFromCart(p);
    }
  }, [order, cartItems, removeFromCart]);

  if (state === "loading") {
    return <div className="grid min-h-[50vh] place-items-center px-4 text-[17px] text-ink-2" role="status">Confirming your order…</div>;
  }
  if (state === "missing" || !order) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-3 px-4 py-20 text-center">
        <h1 className="display text-[40px]">Still processing</h1>
        <p className="text-ink-2">Your payment went through. Refresh in a minute, or check your email for the receipt.</p>
        <button type="button" onClick={() => window.location.reload()} className="btn btn-blue">Refresh</button>
      </div>
    );
  }

  const first = order.items[0];
  const firstImg = first?.artwork?.imageUrl || first?.imageUrl;
  const artist = first?.artwork?.artist;
  const code = orderCode(order.id);
  const count = order.items.reduce((n, it) => n + (it.quantity || 1), 0);

  return (
    <div className="mx-auto grid max-w-[880px] gap-5 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] md:gap-x-12 md:gap-y-5 md:py-14">
      <title>Thank you · Artfinity</title>
      {firstImg && (
        <div className="rounded-[22px] bg-gallery bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#e9e6df_70%)] px-[14%] py-[8%] md:col-start-1 md:row-span-2 md:row-start-1 md:self-center md:py-[10%]">
          <div className="mx-auto w-fit rotate-[-1.5deg] bg-white p-2 shadow-[0_18px_40px_-12px_rgba(21,22,27,.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={firstImg} alt={first?.artwork?.title || first?.title || "Your print"} className="block max-h-[30vh] w-auto md:max-h-[52vh]" />
          </div>
        </div>
      )}

      {/* phones: "It's yours" and the arrival date come first, above the picture */}
      <div className="order-first md:order-none md:col-start-2 md:row-start-1 md:self-end">
          <span className="sticker-badge">Order {code}</span>
          <h1 className="display relative mt-3 text-[48px] md:text-[64px]">
            It&apos;s yours
            <BrushStroke className="mt-1 h-3 w-40" />
          </h1>
          <p className="mt-2 text-[17px] text-ink-2">
            {count > 1 ? "We're printing them now." : "We're printing it now."} Arrives {deliveryRange()}.
          </p>
      </div>

      <div className="grid content-start gap-5 md:col-start-2 md:row-start-2">

        <ul className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.artwork?.imageUrl || it.imageUrl || ""} alt="" className="h-14 w-11 shrink-0 rounded-[2px] object-cover" />
              <div className="min-w-0 flex-1 leading-tight">
                <b className="block truncate">{it.artwork?.title || it.title}</b>
                <span className="text-[13px] text-ink-2">
                  {sizeOf(it.size).label}
                  {it.frameChosen ? ` · ${it.frameColor ?? ""} frame` : ""}
                  {it.quantity > 1 ? ` · ×${it.quantity}` : ""}
                </span>
                {it.editionNumber && it.artwork?.editionSize ? (
                  <span className="mt-1 block w-fit rounded-full bg-sticker px-2 py-0.5 text-[12px] font-bold">{editionLabel(it.editionNumber, it.quantity, it.artwork.editionSize)}</span>
                ) : null}
                {it.certPath && (
                  <a href={it.certPath} target="_blank" rel="noopener" className="mt-1 block w-fit text-[13px] font-semibold text-scan underline-offset-2 hover:underline">
                    Certificate of authenticity
                  </a>
                )}
              </div>
              <span className="num font-semibold">{usd(it.lineTotal)}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between py-3">
            <span className="font-bold">Paid</span>
            <span className="num font-display text-[26px] font-extrabold [font-variation-settings:'wdth'_80]">{usd(order.amountTotal)}</span>
          </li>
        </ul>

        <dl className="grid gap-1 text-[14.5px]">
          {order.email && (
            <div className="flex gap-2"><dt className="text-ink-2">Receipt</dt><dd className="min-w-0 break-words font-semibold">{order.email}</dd></div>
          )}
          {order.shippingAddress && (
            <div className="flex gap-2"><dt className="text-ink-2">Ships to</dt><dd className="min-w-0 break-words">{[order.shippingName, order.shippingAddress].filter(Boolean).join(", ")}</dd></div>
          )}
        </dl>

        <div className="flex flex-wrap gap-2">
          {artist?.slug && <Link href={`/@${artist.slug}`} className="btn btn-blue">More by {artist.name?.split(" ")[0] || "the artist"}</Link>}
          <Link href="/art" className="btn btn-ghost">Browse art</Link>
        </div>
        {artist?.name && <p className="text-[13.5px] text-ink-2">{artist.name} gets 60% of the profit from this sale.</p>}
        {order.helpPath && (
          <p className="text-[14px] text-ink-2">
            Arrived damaged or not quite right? <Link href={order.helpPath} className="font-semibold text-ink underline underline-offset-4">Tell us and we&apos;ll fix it</Link>
          </p>
        )}
      </div>
    </div>
  );
}
