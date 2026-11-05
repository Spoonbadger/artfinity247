"use client";

import { useEffect, useMemo, useState } from "react";
import ReviewStars from "@/components/reviews/ReviewStars";
import MerchPreview from "@/components/art/MerchPreview";
import ReviewList from "@/components/reviews/ReviewList";
import type { PublicReview, ReviewSummary } from "@/components/reviews/format";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";
import { useCart, useUser } from "@/components/contexts";
import SensitiveImage from "@/components/site/SensitiveImage";
import { cn } from "@/lib/utils";
import EditionBadge from "@/components/art/EditionBadge";
import WishlistHeart from "@/components/collector/WishlistHeart";
import ArtGallery, { type GalleryRequest } from "@/components/art/ArtGallery";
import { InlineBadges } from "@/components/artist/TrustBlock";
import type { Trust } from "@/lib/artistTrust";
import type { Detail, GalleryRoom } from "@/lib/artGallery";
import { FREE_SPLIT, pct as pctOf } from "@/lib/plans";
import { FRAME_COLORS, FrameColor, PRINT_SIZES, PrintSize, SIZE_IN, SIZE_LABEL, framePrice, priceFor, sizeInches, usd } from "@/components/art/pricing";
import type { MoreArt, ScanArt, ScanArtist, ScanCartProduct } from "@/components/art/types";
import { artistPath, artPath } from "@/lib/urls";
import { closestSize, originalText, splitOriginal } from "@/lib/originalSize";
import { recall, remember } from "@/lib/smartFields";

const canOptimize = (src: string) => src.startsWith("/") || src.includes("res.cloudinary.com");

const cartKey = (p: { id: string; selectedSize: string; frameChosen: boolean; frameColor: string | null }) =>
  [p.id, p.selectedSize, p.frameChosen ? "framed" : "unframed", p.frameColor ?? ""].join("|");

export default function ScanView({
  art,
  artist,
  more,
  venue, venueHref = null,
  pct,
  sig = null,
  code = null,
  isOwner,
  trust = null,
  artistSplit = FREE_SPLIT,
  arrives = null,
  reviews = null,
  discountEnded = false,
  rooms = [],
  details = [],
  aspect: aspectFromServer = null,
}: {
  art: ScanArt;
  artist: ScanArtist;
  more: MoreArt[];
  venue: string | null; venueHref?: string | null; // venueHref: the partner venue page (/venues/<slug>), when the code hangs at one
  pct: number;
  /** Signature that makes the discount valid at checkout. */
  sig?: string | null;
  /** Short link code the visitor came from (/q/CODE); checkout re-checks it and credits the sale to it. */
  code?: string | null;
  isOwner: boolean;
  /** Medal + real verification for the artist line (lib/artistTrust). */
  trust?: Trust | null;
  /** Artist's share of profit on a sale today (Infinity or Free). */
  artistSplit?: number;
  /** Delivery estimate, e.g. "Nov 12–18" (lib/delivery). */
  arrives?: string | null;
  /** An old card's discount that's no longer honored: say so instead of letting it vanish. */
  discountEnded?: boolean;
  /** Verified buyer reviews: this piece's, or the artist's overall when the piece has few. */
  reviews?: { summary: ReviewSummary; reviews: PublicReview[]; scope: "art" | "artist" } | null;
  /** Gallery rooms (photo scenes first, then drawn) and close-up spots (lib/artGallery). */
  rooms?: GalleryRoom[];
  details?: Detail[];
  /** Image width / height when the server could read it; otherwise measured in the browser. */
  aspect?: number | null;
}) {
  const router = useRouter();
  const { addToCart, cartItems } = useCart();
  const { currentUser } = useUser();

  // Only sizes the file is sharp enough for; an empty list means it wasn't checked, so show all.
  const sizes = useMemo(() => {
    const ok = PRINT_SIZES.filter((s) => art.printableSizes?.includes(s));
    return ok.length ? ok : PRINT_SIZES;
  }, [art.printableSizes]);
  // "Original: 24 × 30 in" rides on the description's first line (lib/originalSize.ts).
  const { original, body: aboutText } = useMemo(() => splitOriginal(art.description), [art.description]);
  const closest = useMemo(() => (original ? closestSize(original, sizes) : null), [original, sizes]);
  const [size, setSize] = useState<PrintSize>(() => (sizes.includes("medium") ? "medium" : sizes[0]));
  const [frame, setFrame] = useState<FrameColor | null>(null);
  // Start from the size and frame this buyer picked last time (when this piece comes in that size).
  useEffect(() => {
    const last = recall<{ size?: PrintSize; frame?: FrameColor | null }>("print-format");
    if (last?.size && sizes.includes(last.size)) setSize(last.size);
    if (last && last.frame !== undefined && (last.frame === null || FRAME_COLORS.some((f) => f.key === last.frame))) setFrame(last.frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [aspect, setAspect] = useState<number>(aspectFromServer || 0.8);
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState<GalleryRequest>(null);
  const landscape = aspect > 1.05;
  const framed = !!frame;
  const soldOut = !!art.edition?.soldOut;

  const price = priceFor(art, size, framed, pct);
  const sizePrices = useMemo(() => Object.fromEntries(PRINT_SIZES.map((s) => [s, priceFor(art, s, framed, pct)])), [art, framed, pct]) as Record<PrintSize, { list: number; now: number }>;
  const firstName = artist.name.split(" ")[0] || artist.name;

  const product = (): ScanCartProduct => ({
    id: art.id,
    slug: art.slug,
    handle: artist.slug,
    title: art.title,
    artist: artist.name,
    imageUrl: art.imageUrl,
    selectedSize: size,
    unitPrice: price.now,
    listPrice: price.list,
    discountPct: pct || undefined,
    discountSig: pct && sig ? sig : undefined,
    code: code || undefined,
    venue,
    frameChosen: framed,
    frameColor: frame,
  });

  const onAdd = () => {
    remember("print-format", { size, frame });
    addToCart(product(), 1);
    toast.success("Added to cart", { action: { label: "View cart", onClick: () => router.push("/cart") } });
  };

  const onBuy = async () => {
    if (busy) return;
    const p = product();
    remember("print-format", { size, frame });
    // kept in the cart in case they back out of payment
    if (!cartItems.some((ci) => cartKey(ci.product) === cartKey(p))) addToCart(p, 1);
    setBusy(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ product: p, quantity: 1 }], buyer: { id: currentUser?.id ?? null, email: currentUser?.email ?? null } }),
      });
      if (res.status === 409) {
        // Limited edition ran out
        const { error } = await res.json().catch(() => ({ error: "" }));
        toast.error(error || "Sold out.");
        setBusy(false);
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      if (!url) throw new Error("No checkout url");
      window.location.href = url;
    } catch (err) {
      console.error("Buy failed", err);
      toast.error("Checkout didn't open. It's in your cart, try from there.");
      setBusy(false);
    }
  };

  const seeInRoom = () => {
    setReq({ slide: "room", t: Date.now() });
    if (window.matchMedia("(max-width: 767px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // "Verified artist · 55 prints sold" (sales only when the artist shows stats)
  const artistLine = [
    trust?.verified ? "Verified artist" : null,
    trust?.showStats && trust.printsSold > 0 ? `${trust.printsSold.toLocaleString("en-US")} print${trust.printsSold === 1 ? "" : "s"} sold` : null,
  ].filter(Boolean).join(" · ");
  const buyLabel = soldOut ? "Sold out" : busy ? "Opening checkout…" : `Buy this print · ${usd(price.now)}`;
  const discountTag = pct > 0 ? `${pct}% off${venue ? ` · ${venue}` : ""}` : null;

  return (
    <div>
      {/* Phones: room for the sticky buy bar; --af-bottom-bar docks the cookie notice above it.
          --af-cookie-wait: the notice waits for the first scroll, so it never covers the title, price or Buy on load. */}
      <style>{`:root { --af-cookie-wait: 1; } @media (max-width: 767px) { :root { --af-bottom-bar: 84px; } body { padding-bottom: calc(92px + env(safe-area-inset-bottom)); } }`}</style>

      <div className="mx-auto grid max-w-[1240px] md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] md:gap-10 md:px-6 md:pt-5 lg:gap-12">
        <ArtGallery
          slug={art.slug}
          title={art.title}
          artistName={artist.name}
          imageUrl={art.imageUrl}
          sensitive={art.sensitive}
          rooms={rooms}
          details={details}
          aspect={aspect}
          size={size}
          frame={frame}
          onAspect={(a) => !aspectFromServer && setAspect(a)}
          request={req}
        />

        {/* Buy panel: everything needed to buy, once */}
        <section aria-label="Buy a print" className="grid min-w-0 content-start gap-4 px-4 pt-3 sm:px-6 md:px-0 md:pt-1">
          <div className="grid gap-1.5">
            <h1 className="display text-[34px] leading-[0.95] sm:text-[40px] lg:text-[46px]">{art.title}</h1>
            {reviews && reviews.summary.count > 0 && <ReviewStars average={reviews.summary.average} count={reviews.summary.count} size="sm" href="#reviews" className="w-fit" />}
          </div>

          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="num font-display text-[36px] font-extrabold leading-none [font-variation-settings:'wdth'_80]">{usd(price.now)}</span>
              {pct > 0 && (
                <s className="num text-[16px] text-ink-2">
                  <span className="sr-only">was </span>
                  {usd(price.list)}
                </s>
              )}
              {discountTag && <span className="max-w-full truncate rounded-full bg-sticker px-2.5 py-1 text-[12.5px] font-bold leading-none text-ink">{discountTag}</span>}
              <EditionBadge edition={art.edition} compact />
              <WishlistHeart artworkId={art.id} title={art.title} variant="inline" className="-my-1 ml-auto" />
            </div>
            {venue && (!pct || venueHref) && <p className="text-[13.5px] text-ink-2">Scanned at {venueHref ? <a href={venueHref} className="font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink">{venue}</a> : <b className="font-semibold text-ink">{venue}</b>}</p>}
            {discountEnded && <p className="text-[13.5px] text-ink-2">The discount on this card has ended. Prices shown are current.</p>}
          </div>

          {/* Size */}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[15px] font-bold">Size</legend>
            <div className={cn("grid gap-2", sizes.length === 4 ? "grid-cols-4" : sizes.length === 3 ? "grid-cols-3" : "grid-cols-2", closest && "pt-1.5")}>
              {sizes.map((s) => {
                const on = s === size;
                const [sw, sh] = SIZE_IN[s];
                return (
                  <label
                    key={s}
                    className={cn(
                      "relative grid cursor-pointer justify-items-center gap-0.5 rounded-xl border-2 bg-white px-1 pb-2 pt-2.5 text-center transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-scan",
                      on ? "border-ink shadow-[inset_0_0_0_1px_var(--af-ink)]" : "border-line hover:border-ink-2",
                    )}
                  >
                    <input type="radio" name="size" value={s} checked={on} onChange={() => setSize(s)} className="sr-only" aria-describedby={s === closest ? "size-note" : undefined} />
                    {s === closest && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-sticker px-1.5 text-[10.5px] font-bold leading-[16px]">
                        ≈ original
                      </span>
                    )}
                    <span className="text-[15px] font-bold leading-tight">{SIZE_LABEL[s]}</span>
                    <span className="num text-[12.5px] leading-tight text-ink-2">{landscape ? `${sh}×${sw}` : `${sw}×${sh}`} in</span>
                    <span className="num text-[13px] font-semibold leading-tight">{usd(sizePrices[s].now)}</span>
                  </label>
                );
              })}
            </div>
            <p id="size-note" className="text-[13px] leading-snug text-ink-2">
              {original && closest ? <>Original {originalText(original)} · </> : <>Not sure? </>}
              <button type="button" onClick={seeInRoom} className="font-semibold text-scan underline decoration-scan/40 underline-offset-2 hover:decoration-scan">
                see it in a room
              </button>
            </p>
          </fieldset>

          {/* Frame: one row of choices */}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[15px] font-bold">
              Frame <span className="num font-normal text-ink-2">· +{usd(framePrice(size))}, ready to hang</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {[{ key: null, label: "None", hex: null as string | null }, ...FRAME_COLORS].map((f) => {
                const on = frame === f.key;
                return (
                  <label
                    key={f.key ?? "none"}
                    className={cn(
                      "flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border-2 bg-white py-1 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-scan",
                      f.hex ? "pl-1.5 pr-3" : "px-3.5",
                      on ? "border-ink shadow-[inset_0_0_0_1px_var(--af-ink)]" : "border-line hover:border-ink-2",
                    )}
                  >
                    <input type="radio" name="frame" value={f.key ?? "none"} checked={on} onChange={() => setFrame(f.key as FrameColor | null)} className="sr-only" />
                    {f.hex && <span className="h-6 w-6 rounded-full border border-ink/25" style={{ background: f.hex }} aria-hidden />}
                    {f.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Buy (desktop; on phones Buy is the sticky bar) and a quiet Add to cart */}
          <div className="flex items-center gap-3 md:pt-1">
            <button type="button" onClick={onBuy} disabled={busy || soldOut} className="btn btn-blue btn-lg hidden flex-1 text-[18px] md:inline-flex">
              {buyLabel}
            </button>
            <button type="button" onClick={onAdd} disabled={soldOut} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-ink underline-offset-2 hover:bg-wall hover:underline disabled:opacity-50 max-md:-ml-3">
              <ShoppingBag className="h-[18px] w-[18px]" aria-hidden /> Add to cart
            </button>
          </div>

          {/* One trust line */}
          <p className="-mt-1 text-[13px] leading-relaxed text-ink-2">
            {arrives ? <><b className="font-semibold text-ink">Arrives {arrives}</b> · free US shipping</> : <b className="font-semibold text-ink">Free US shipping</b>}
            {" · "}
            <Link href="/return-policy" className="underline decoration-line underline-offset-2 hover:text-ink">damaged? free reprint</Link>
            {" · secure checkout"}
          </p>
        </section>
      </div>

      {/* Below the fold: the rest, once each */}
      <div className="mx-auto mt-10 grid max-w-[1240px] gap-8 border-t border-line px-4 pt-8 sm:px-6 md:mt-14 md:grid-cols-2 md:gap-12 md:pt-10">
        <section aria-labelledby="about-h" className="grid content-start gap-3">
          <h2 id="about-h" className="text-[18px] font-bold">About this piece</h2>
          {aboutText.trim() && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{aboutText}</p>}
          {original && <p className="text-[15px] text-ink-2">Original: {originalText(original)}</p>}
          <Link href={artistPath(artist.slug)} className="group mt-1 flex w-fit items-center gap-3 text-ink no-underline">
            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-wall">
              {artist.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artist.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-sm font-bold">{artist.name[0]}</span>
              )}
            </span>
            <span className="leading-tight">
              <span className="flex items-center gap-1 text-[15px] font-bold group-hover:underline">
                {artist.name}
                <InlineBadges trust={trust} size={16} className="ml-0.5" />
              </span>
              <span className="block text-[13.5px] text-ink-2">{[artist.place, artistLine].filter(Boolean).join(" · ")}</span>
            </span>
          </Link>
        </section>

        <section aria-labelledby="print-h" className="grid content-start gap-3">
          <h2 id="print-h" className="text-[18px] font-bold">The print{framed ? " and frame" : ""}</h2>
          <ul className="grid list-disc gap-1.5 pl-5 text-[15px] leading-snug text-ink-2 marker:text-line">
            <li>
              {SIZE_LABEL[size]}, {sizeInches(size)}. 12-color giclée on smooth matte, FSC-certified 310gsm archival paper, with a ½-inch handling border. Keeps the artwork&apos;s proportions.
            </li>
            {frame && <li>{FRAME_COLORS.find((f) => f.key === frame)?.label} frame made for the {sizeInches(size)} print, ready to hang. Priced by Artfinity, the same for every artist.</li>}
            <li>Printed and shipped by Artfinity. {firstName} gets {pctOf(artistSplit)} of the profit.</li>
            <li>Size is final sale, so check it in a room first. Arrives damaged? <Link href="/return-policy" className="font-semibold text-ink underline decoration-line underline-offset-2">We reprint it free.</Link></li>
          </ul>
          <Link href="/help/buyers" className="w-fit text-[14px] text-ink-2 underline decoration-line underline-offset-2 hover:text-ink">Shipping, frames and returns</Link>
        </section>
      </div>

      {reviews && reviews.summary.count > 0 && (
        <section id="reviews" aria-labelledby="reviews-h" className="mx-auto mt-12 max-w-[1240px] scroll-mt-20 px-4 sm:px-6 md:mt-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 id="reviews-h" className="display text-[28px] md:text-[36px]">{reviews.scope === "art" ? "What buyers say" : `Buyers of ${firstName}'s prints`}</h2>
            <ReviewStars average={reviews.summary.average} count={reviews.summary.count} />
          </div>
          <ReviewList reviews={reviews.reviews} artistName={artist.name} showArtwork={reviews.scope === "artist"} initial={3} />
        </section>
      )}

      <section aria-labelledby="more-h" className="mx-auto mt-12 max-w-[1240px] px-4 sm:px-6 md:mt-16">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="more-h" className="display text-[28px] md:text-[36px]">More by {firstName}</h2>
          <Link href={artistPath(artist.slug)} className="btn btn-ghost btn-sm min-h-[44px] px-4 md:min-h-0">See all</Link>
        </div>
        {more.length ? (
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:[&>li:nth-child(n+4)]:hidden lg:grid-cols-4 lg:[&>li:nth-child(4)]:block">
            {more.map((m) => (
              <li key={m.slug} className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <Link href={artPath(artist.slug, m.slug)} className="group grid gap-2 text-ink no-underline">
                  <div className="aspect-[4/5] overflow-hidden rounded-lg bg-gallery">
                    <SensitiveImage labels={m.sensitive}>
                      <Image
                        src={m.imageUrl}
                        alt={m.title}
                        width={480}
                        height={600}
                        unoptimized={!canOptimize(m.imageUrl)}
                        sizes="(min-width: 1024px) 280px, (min-width: 640px) 30vw, 44vw"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    </SensitiveImage>
                  </div>
                  <span className="leading-tight">
                    <b className="block text-[15px] group-hover:underline">{m.title}</b>
                    <span className="num text-[13px] text-ink-2">from {usd(m.fromCents)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">This is {firstName}&apos;s first piece here.</p>
        )}
      </section>

      {art.sensitive.length === 0 && <MerchPreview imageUrl={art.imageUrl} title={art.title} artistFirstName={firstName} />}

      <p className="mx-auto max-w-[1240px] px-4 pt-4 text-[13px] text-ink-2 sm:px-6">
        <Link href={`/report?art=${encodeURIComponent(art.slug)}`} className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-ink">
          Report this art
        </Link>
      </p>

      {/* Sticky buy bar on phones: price, and arrival + secure once */}
      {(
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden">
          <button type="button" onClick={onBuy} disabled={busy || soldOut} className="btn btn-blue w-full py-3 text-[17px]">
            {buyLabel}
          </button>
          <p className="mt-1 text-center text-[12.5px] text-ink-2">{arrives ? `Arrives ${arrives} · free shipping · secure checkout` : "Free US shipping · secure checkout"}</p>
        </div>
      )}
    </div>
  );
}
