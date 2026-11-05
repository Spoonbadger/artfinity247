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
import { Lock, ShoppingBag } from "lucide-react";
import { useCart, useUser } from "@/components/contexts";
import SensitiveImage from "@/components/site/SensitiveImage";
import { useSensitivePref } from "@/components/site/useSensitivePref";
import { tagSVG } from "@/lib/qr/render";
import { cn } from "@/lib/utils";
import RoomCarousel from "@/components/rooms/RoomCarousel";
import EditionBadge from "@/components/art/EditionBadge";
import QtyStepper from "@/components/art/QtyStepper";
import ArtZoom from "@/components/art/ArtZoom";
import PrintNote from "@/components/art/PrintNote";
import { InlineBadges } from "@/components/artist/TrustBlock";
import type { Trust } from "@/lib/artistTrust";
import { FREE_SPLIT, pct as pctOf } from "@/lib/plans";
import {
  FRAME_COLORS,
  FrameColor,
  PRINT_SIZES,
  PrintSize,
  SIZE_IN,
  SIZE_LABEL,
  escapeXml,
  framePrice,
  priceFor,
  sizeInches,
  usd,
} from "@/components/art/pricing";
import type { MoreArt, ScanArt, ScanArtist, ScanCartProduct } from "@/components/art/types";
import { artistPath, artPath } from "@/lib/urls";
import FollowButton from "@/components/follow/FollowButton";
import { closestSize, originalText, splitOriginal } from "@/lib/originalSize";
import FrameNote from "@/components/art/FrameNote";

const canOptimize = (src: string) => src.startsWith("/") || src.includes("res.cloudinary.com");

const cartKey = (p: { id: string; selectedSize: string; frameChosen: boolean; frameColor: string | null }) =>
  [p.id, p.selectedSize, p.frameChosen ? "framed" : "unframed", p.frameColor ?? ""].join("|");

export default function ScanView({
  art,
  artist,
  more,
  venue,
  pct,
  sig = null,
  code = null,
  isOwner,
  status = "APPROVED",
  trust = null,
  artistSplit = FREE_SPLIT,
  arrives = null,
  reviews = null,
  discountEnded = false,
}: {
  art: ScanArt;
  artist: ScanArtist;
  more: MoreArt[];
  venue: string | null;
  pct: number;
  /** Signature that makes the discount valid at checkout. */
  sig?: string | null;
  /** Short link code the visitor came from (/q/CODE); checkout re-checks it and credits the sale to it. */
  code?: string | null;
  isOwner: boolean;
  status?: string;
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
}) {
  const router = useRouter();
  const { addToCart, cartItems } = useCart();
  const { currentUser } = useUser();
  const [sensitivePref] = useSensitivePref();

  // Only sizes the file is sharp enough for; an empty list means it wasn't checked, so show all.
  const sizes = useMemo(() => {
    const ok = PRINT_SIZES.filter((s) => art.printableSizes?.includes(s));
    return ok.length ? ok : PRINT_SIZES;
  }, [art.printableSizes]);
  // "Original: 24 × 30 in" rides on the description's first line (lib/originalSize.ts).
  const { original, body: aboutText } = useMemo(() => splitOriginal(art.description), [art.description]);
  const closest = useMemo(() => (original ? closestSize(original, sizes) : null), [original, sizes]);
  const [size, setSize] = useState<PrintSize>(() => (sizes.includes("medium") ? "medium" : sizes[0]));
  const [framed, setFramed] = useState(false);
  const [frameColor, setFrameColor] = useState<FrameColor>("black");
  const [landscape, setLandscape] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const maxQty = Math.max(1, Math.min(10, art.edition ? art.edition.left : 10));
  const [following, setFollowing] = useState(false);

  const followKey = `af:follow:${artist.slug}`;
  useEffect(() => {
    try { setFollowing(localStorage.getItem(followKey) === "1"); } catch {}
  }, [followKey]);

  const price = priceFor(art, size, framed, pct);
  const sizePrices = useMemo(() => Object.fromEntries(PRINT_SIZES.map((s) => [s, priceFor(art, s, framed, pct)])), [art, framed, pct]) as Record<PrintSize, { list: number; now: number }>;
  const firstName = artist.name.split(" ")[0] || artist.name;
  const tag = useMemo(() => {
    if (!pct) return "";
    const sub = venue && venue.length <= 22 ? `at ${venue}` : "when you scan";
    return tagSVG(pct, "#ffd43b", "#15161b", escapeXml(sub));
  }, [pct, venue]);

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
    frameColor: framed ? frameColor : null,
  });

  const putInCart = (p: ScanCartProduct, onlyIfMissing: boolean) => {
    const exists = cartItems.some((ci) => cartKey(ci.product) === cartKey(p));
    if (onlyIfMissing && exists) return;
    addToCart(p, Math.min(qty, maxQty));
  };

  const onAdd = () => {
    putInCart(product(), false);
    toast.success("Added to cart", { action: { label: "View cart", onClick: () => router.push("/cart") } });
  };

  const onBuy = async () => {
    if (busy) return;
    const p = product();
    putInCart(p, true); // kept in the cart in case they back out of payment
    setBusy(true);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ product: p, quantity: Math.min(qty, maxQty) }],
          buyer: { id: currentUser?.id ?? null, email: currentUser?.email ?? null },
        }),
      });
      if (res.status === 409) {
        // Limited edition ran out (or fewer left than asked)
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

  const onFollow = () => {
    const next = !following;
    setFollowing(next);
    try { localStorage.setItem(followKey, next ? "1" : "0"); } catch {}
    if (next) toast.success("You'll hear about new work");
  };

  const soldOut = !!art.edition?.soldOut;
  // "Verified artist · 55 prints sold" (sales only when the artist shows stats)
  const artistLine = [
    trust?.verified ? "Verified artist" : null,
    trust?.showStats && trust.printsSold > 0 ? `${trust.printsSold.toLocaleString("en-US")} print${trust.printsSold === 1 ? "" : "s"} sold` : null,
  ].filter(Boolean).join(" · ");
  const buyLabel = soldOut ? "Sold out" : busy ? "Opening checkout…" : `${qty > 1 ? `Buy ${qty} prints` : "Buy this print"} · ${usd(price.now * Math.min(qty, maxQty))}`;

  return (
    <div>
      {/* room for the sticky buy bar under the footer on phones */}
      {/* --af-bottom-bar lets the cookie notice float above the buy bar instead of covering it */}
      <style>{`@media (max-width: 767px) { :root { --af-bottom-bar: 104px; } body { padding-bottom: calc(112px + env(safe-area-inset-bottom)); } }`}</style>
      {venue && (
        <div className="bg-ink text-white">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2 text-[14px] sm:px-6">
            <span>
              You scanned this at <b className="text-sticker">{venue}</b>
            </span>
            {pct > 0 && <span className="hidden text-white/80 sm:inline">Your {pct}% discount is applied</span>}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="border-b border-line bg-scan-soft">
          <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-2 text-[14px] sm:px-6">
            <span className="font-semibold">
              This is your piece
              {status !== "APPROVED" && <span className="font-normal text-ink-2"> · {status === "REJECTED" ? "Not approved, buyers can't see it" : "In review, buyers can't buy it yet"}</span>}
            </span>
            <a className="font-bold text-scan" href={`/api/artworks/${art.slug}/qr?download=1`} target="_blank" rel="noopener">
              Download its QR code
            </a>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1240px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12 md:px-6 md:py-10 lg:gap-16">
        {/* The painting */}
        <section aria-label="The painting" className="md:sticky md:top-24 md:self-start">
          <div className="relative flex min-h-[calc(46svh+66px)] flex-col justify-center bg-gallery bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#e9e6df_70%)] px-5 pb-9 pt-5 md:block md:min-h-0 md:rounded-[22px] md:px-[10%] md:py-[9%]">
            <div className="relative mx-auto w-fit">
              <div className="overflow-hidden bg-white p-[5px] shadow-[0_18px_40px_-12px_rgba(21,22,27,.45),0_2px_6px_rgba(21,22,27,.12)] md:p-2.5">
                <SensitiveImage labels={art.sensitive} light>
                  <Image
                    src={art.imageUrl}
                    alt={`${art.title} by ${artist.name}`}
                    width={1200}
                    height={1500}
                    priority
                    unoptimized={!canOptimize(art.imageUrl)}
                    sizes="(min-width: 768px) 45vw, 92vw"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setLandscape(img.naturalWidth > img.naturalHeight * 1.05);
                    }}
                    onClick={() => setZoom(true)}
                    className="block h-auto max-h-[46svh] w-auto max-w-full cursor-zoom-in md:max-h-[72vh]"
                  />
                </SensitiveImage>
              </div>
              <ZoomButton onClick={() => setZoom(true)} hidden={art.sensitive.length > 0 && !sensitivePref} />
              {pct > 0 && (
                <div
                  className="pointer-events-none absolute -bottom-7 -right-3 w-[150px] rotate-[-7deg] drop-shadow-[0_4px_0_rgba(21,22,27,.18)] sm:w-[190px] md:-right-10 md:w-[230px]"
                  dangerouslySetInnerHTML={{ __html: tag }}
                />
              )}
            </div>
          </div>
        </section>

        {/* Buy panel */}
        <section aria-label="Buy a print" className="grid min-w-0 content-start gap-5 px-4 pt-5 sm:px-6 md:px-0 md:pt-2">
          <div className="grid gap-2">
            <Link href={artistPath(artist.slug)} className="group flex min-h-[44px] w-fit items-center gap-2.5 text-ink no-underline">
              <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-wall ring-2 ring-white">
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
                  <InlineBadges trust={trust} size={17} className="ml-0.5" />
                </span>
                {artist.place && <span className="block text-[13px] text-ink-2">{artist.place}</span>}
              </span>
            </Link>
            <h1 className="display text-[44px] leading-[0.92] sm:text-[56px] lg:text-[68px]">{art.title}</h1>
            {reviews && reviews.summary.count > 0 && (
              <ReviewStars average={reviews.summary.average} count={reviews.summary.count} size="sm" href="#reviews" className="mt-2" />
            )}
          </div>

          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="num font-display text-[40px] font-extrabold leading-none [font-variation-settings:'wdth'_80]">{usd(price.now)}</span>
            {pct > 0 && <s className="num pb-1 text-[17px] text-ink-2">{usd(price.list)}</s>}
            <span className="pb-1 text-[15px] text-ink-2">
              {SIZE_LABEL[size]} · {sizeInches(size)}
              {framed ? " · framed" : ""}
            </span>
          </div>
          {discountEnded && (
            <p className="-mt-2 text-[14px] text-ink-2">The discount on this card has ended. Prices shown are current.</p>
          )}
          <EditionBadge edition={art.edition} className="-mt-2" />

          {/* Size */}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[15px] font-bold">Size</legend>
            <div className={cn("grid gap-2", sizes.length === 4 ? "grid-cols-4" : "grid-cols-3", closest && "pt-1.5")}>
              {sizes.map((s) => {
                const on = s === size;
                const [sw, sh] = SIZE_IN[s];
                return (
                  <label
                    key={s}
                    className={cn(
                      "relative grid cursor-pointer justify-items-center gap-1 rounded-2xl border-2 bg-white px-1 pb-2.5 pt-3 text-center transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-scan",
                      on ? "border-ink shadow-[inset_0_0_0_1px_var(--af-ink)]" : "border-line hover:border-ink-2",
                    )}
                  >
                    <input type="radio" name="size" value={s} checked={on} onChange={() => setSize(s)} className="sr-only" aria-describedby={s === closest ? "closest-note" : undefined} />
                    {s === closest && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-sticker px-1.5 text-[10.5px] font-bold leading-[16px]" aria-hidden>
                        ≈ original
                      </span>
                    )}
                    <span className="grid h-7 place-items-end" aria-hidden>
                      <span
                        className={cn("block rounded-[2px] border-[1.5px]", on ? "border-ink bg-sticker" : "border-ink-2 bg-wall")}
                        style={{ width: `${(landscape ? sh : sw) * 1.05 + 6}px`, height: `${(landscape ? sw : sh) * 0.85 + 6}px`, maxHeight: 28 }}
                      />
                    </span>
                    <span className="text-[15px] font-bold leading-tight">{SIZE_LABEL[s]}</span>
                    <span className="num text-[13px] leading-tight text-ink-2">
                      {landscape ? `${sh}×${sw}` : `${sw}×${sh}`} in
                    </span>
                    <span className="num text-[13px] font-semibold leading-tight">{usd(sizePrices[s].now)}</span>
                  </label>
                );
              })}
            </div>
            {/* Size help: wrong-size prints are final (return policy), so point at the original and the room preview */}
            <p className="mt-0.5 grid gap-0.5 text-[13.5px] leading-snug text-ink-2">
              {original && closest && (
                <span id="closest-note">
                  <b className="font-semibold text-ink">Original {originalText(original)}</b> · ≈ marks the size closest to the original
                </span>
              )}
              <span>
                Not sure? Prints are final sale for size —{" "}
                <a href="#on-a-wall" className="font-semibold text-scan underline decoration-scan/40 underline-offset-2 hover:decoration-scan">see it on a wall</a>
              </span>
            </p>
          </fieldset>

          {/* Frame */}
          <div className="grid gap-3 rounded-2xl border border-line p-3.5">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-[15px] font-bold">Add a frame</span>
                <span className="num text-[13px] text-ink-2">+{usd(framePrice(size))}, ready to hang</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={framed}
                onChange={(e) => setFramed(e.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-7 w-12 shrink-0 rounded-full border-2 border-ink bg-white transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-ink after:transition peer-checked:bg-scan peer-checked:border-scan peer-checked:after:translate-x-5 peer-checked:after:bg-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan"
              />
            </label>
            {framed && (
              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="sr-only">Frame color</legend>
                {FRAME_COLORS.map((f) => (
                  <label
                    key={f.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan",
                      frameColor === f.key ? "border-ink" : "border-line",
                    )}
                  >
                    <input type="radio" name="frame" value={f.key} checked={frameColor === f.key} onChange={() => setFrameColor(f.key)} className="sr-only" />
                    <span className="h-6 w-6 rounded-full border border-ink/25" style={{ background: f.hex }} aria-hidden />
                    {f.label}
                  </label>
                ))}
              </fieldset>
            )}
            {framed && <FrameNote color={frameColor} size={size} />}
          </div>

          {/* The print at true size in rooms the artist picked (or auto-picked); a different room each visit */}
          <div id="on-a-wall" className="scroll-mt-20 md:order-last">
            <RoomCarousel
              artwork={{ slug: art.slug, imageUrl: art.imageUrl, title: art.title, roomScenes: art.roomScenes ?? [] }}
              size={size}
              frame={framed ? frameColor : null}
              landscape={landscape}
              blur={art.sensitive.length > 0 && !sensitivePref}
            />
          </div>

          {/* Buttons (desktop shows Buy here; on phones Buy is the sticky bar) */}
          <div className="grid gap-2.5">
            {!soldOut && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-bold">Quantity{art.edition && <span className="num ml-1.5 text-[13px] font-normal text-ink-2">max {maxQty}</span>}</span>
                <QtyStepper value={Math.min(qty, maxQty)} onChange={setQty} max={maxQty} />
              </div>
            )}
            <button type="button" onClick={onBuy} disabled={busy || soldOut} className="btn btn-blue btn-lg hidden w-full text-[18px] md:inline-flex">
              {buyLabel}
            </button>
            <button type="button" onClick={onAdd} disabled={soldOut} className="btn btn-ghost w-full">
              <ShoppingBag className="h-[18px] w-[18px]" aria-hidden /> Add to cart
            </button>
            <p className="hidden items-center justify-center gap-1.5 text-[13px] text-ink-2 md:flex">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Apple Pay · Google Pay · Card
            </p>
          </div>

          {/* Trust row: one short line each */}
          <ul aria-label="Buying with confidence" className="md:order-6 grid gap-2.5 border-t border-line pt-4 text-[14px] leading-snug">
            <li className="flex items-center gap-2.5">
              <Dab c="var(--af-scan)" />
              <span>{arrives ? <><b>Arrives {arrives}</b> · free US shipping</> : <b>Free US shipping</b>}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Dab c="var(--af-coral)" />
              <span>
                Arrives damaged?{" "}
                <Link href="/return-policy" className="font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink">We reprint it free.</Link>
              </span>
            </li>
            {artistLine && (
              <li className="flex items-center gap-2.5">
                <Dab c="var(--af-sticker)" />
                <span>{artistLine}</span>
                <InlineBadges trust={trust} size={15} className="-ml-1" />
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <Dab c="var(--af-earned)" />
              <span>{firstName} gets {pctOf(artistSplit)} of the profit</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Dab c="var(--af-ink)" />
              <span>
                Printed and shipped by Artfinity ·{" "}
                <Link href="/about-us" className="text-ink-2 underline decoration-line underline-offset-2 hover:text-ink">Who we are</Link>
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Secure checkout by Stripe</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Dab c="#9aa0ff" />
              <span>
                Questions?{" "}
                <Link href="/help/buyers" className="text-ink-2 underline decoration-line underline-offset-2 hover:text-ink">Shipping, frames and returns</Link>
              </span>
            </li>
          </ul>
          <PrintNote className="md:order-last" />

          {aboutText.trim() && (
            <details className="md:order-last group border-t border-line pt-4">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[15px] font-bold marker:hidden">
                About this piece <span className="font-normal text-ink-2 group-open:hidden">· show</span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-[15px] text-ink-2">{aboutText}</p>
            </details>
          )}
        </section>
      </div>

      {/* After the fold */}
      {art.sensitive.length === 0 && <MerchPreview imageUrl={art.imageUrl} title={art.title} artistFirstName={firstName} />}

      {reviews && reviews.summary.count > 0 && (
        <section id="reviews" aria-label="Reviews" className="mx-auto mt-10 max-w-[1240px] scroll-mt-20 border-t border-line px-4 pt-8 sm:px-6 md:mt-16 md:pt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2 className="display text-[30px] md:text-[40px]">{reviews.scope === "art" ? "What buyers say" : `Buyers of ${firstName}'s prints`}</h2>
            <ReviewStars average={reviews.summary.average} count={reviews.summary.count} />
          </div>
          <ReviewList reviews={reviews.reviews} artistName={artist.name} showArtwork={reviews.scope === "artist"} initial={3} />
        </section>
      )}

      <section aria-label={`More by ${artist.name}`} className="mx-auto mt-10 max-w-[1240px] border-t border-line px-4 pt-8 sm:px-6 md:mt-16 md:pt-12">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-[30px] md:text-[40px]">More by {firstName}</h2>
          <div className="flex items-center gap-2">
            <Link href={artistPath(artist.slug)} className="btn btn-ghost btn-sm min-h-[44px] px-4 md:min-h-0">See all</Link>
            <FollowButton handle={artist.slug} firstName={firstName} label={`Follow ${firstName}`} className="btn btn-sm min-h-[44px] px-4 md:min-h-0" idleClassName="btn-blue" doneClassName="btn-ghost" />
          </div>
        </div>
        {more.length ? (
          <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 sm:[&>li:nth-child(n+4)]:hidden lg:[&>li:nth-child(4)]:block sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4">
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

      <p className="mx-auto max-w-[1240px] px-4 pt-4 text-[13px] text-ink-2 sm:px-6">
        <Link href={`/report?art=${encodeURIComponent(art.slug)}`} className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-ink">Report this art</Link>
      </p>

      <ArtZoom open={zoom} onClose={() => setZoom(false)} src={art.imageUrl} alt={`${art.title} by ${artist.name}`} />

      {/* Sticky buy bar on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden">
        <button type="button" onClick={onBuy} disabled={busy || soldOut} className="btn btn-blue w-full py-3.5 text-[17px]">
          {buyLabel}
        </button>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
          <Lock className="h-3 w-3" aria-hidden /> {arrives ? <>Secure checkout · Arrives {arrives}</> : "Apple Pay · Google Pay · Card"}
        </p>
      </div>
    </div>
  );
}

const Dab = ({ c }: { c: string }) => <i aria-hidden className="paint-dab" style={{ ["--dab" as string]: c }} />;

function ZoomButton({ onClick, hidden }: { onClick: () => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Zoom in on the painting"
      className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-[0_2px_8px_rgba(21,22,27,.25)] transition hover:bg-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan"
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l4.5 4.5M8.5 6v5M6 8.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </button>
  );
}
