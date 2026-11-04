"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Lock, ShoppingBag } from "lucide-react";
import { useCart, useUser } from "@/components/contexts";
import SensitiveImage from "@/components/site/SensitiveImage";
import { useSensitivePref } from "@/components/site/useSensitivePref";
import { tagSVG } from "@/lib/qr/render";
import { cn } from "@/lib/utils";
import WallPreview from "@/components/art/WallPreview";
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

const canOptimize = (src: string) => src.startsWith("/") || src.includes("res.cloudinary.com");

const cartKey = (p: { id: string; selectedSize: string; frameChosen: boolean; frameColor: string | null }) =>
  [p.id, p.selectedSize, p.frameChosen ? "framed" : "unframed", p.frameColor ?? ""].join("|");

export default function ScanView({
  art,
  artist,
  more,
  venue,
  pct,
  isOwner,
}: {
  art: ScanArt;
  artist: ScanArtist;
  more: MoreArt[];
  venue: string | null;
  pct: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const { addToCart, cartItems } = useCart();
  const { currentUser } = useUser();
  const [sensitivePref] = useSensitivePref();

  const [size, setSize] = useState<PrintSize>("medium");
  const [framed, setFramed] = useState(false);
  const [frameColor, setFrameColor] = useState<FrameColor>("black");
  const [landscape, setLandscape] = useState(false);
  const [busy, setBusy] = useState(false);
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
    title: art.title,
    artist: artist.name,
    imageUrl: art.imageUrl,
    selectedSize: size,
    unitPrice: price.now,
    listPrice: price.list,
    discountPct: pct || undefined,
    venue,
    frameChosen: framed,
    frameColor: framed ? frameColor : null,
  });

  const putInCart = (p: ScanCartProduct, onlyIfMissing: boolean) => {
    const exists = cartItems.some((ci) => cartKey(ci.product) === cartKey(p));
    if (onlyIfMissing && exists) return;
    addToCart(p, 1);
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
          items: [{ product: p, quantity: 1 }],
          buyer: { id: currentUser?.id ?? null, email: currentUser?.email ?? null },
        }),
      });
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

  const buyLabel = busy ? "Opening checkout…" : `Buy this print · ${usd(price.now)}`;

  return (
    <div className="pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-0">
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
            <span className="font-semibold">This is your piece</span>
            <a className="font-bold text-scan" href={`/api/artworks/${art.slug}/qr?download=1`} target="_blank" rel="noopener">
              Download its QR code
            </a>
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1240px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-12 md:px-6 md:py-10 lg:gap-16">
        {/* The painting */}
        <section aria-label="The painting" className="md:sticky md:top-24 md:self-start">
          <div className="relative bg-gallery bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#e9e6df_70%)] px-5 pb-9 pt-5 md:rounded-[22px] md:px-[10%] md:py-[9%]">
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
                    className="block h-auto max-h-[52svh] w-auto max-w-full md:max-h-[72vh]"
                  />
                </SensitiveImage>
              </div>
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
            <Link href={`/@${artist.slug}`} className="group flex w-fit items-center gap-2.5 text-ink no-underline">
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
                  {art.approved && <BadgeCheck aria-label="Verified artist" className="h-4 w-4 text-scan" />}
                </span>
                {artist.place && <span className="block text-[13px] text-ink-2">{artist.place}</span>}
              </span>
            </Link>
            <h1 className="display text-[44px] leading-[0.92] sm:text-[56px] lg:text-[68px]">{art.title}</h1>
          </div>

          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="num font-display text-[40px] font-extrabold leading-none [font-variation-settings:'wdth'_80]">{usd(price.now)}</span>
            {pct > 0 && <s className="num pb-1 text-[17px] text-ink-2">{usd(price.list)}</s>}
            <span className="pb-1 text-[15px] text-ink-2">
              {SIZE_LABEL[size]} · {sizeInches(size)}
              {framed ? " · framed" : ""}
            </span>
          </div>

          {/* Size */}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[15px] font-bold">Size</legend>
            <div className="grid grid-cols-4 gap-2">
              {PRINT_SIZES.map((s) => {
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
                    <input type="radio" name="size" value={s} checked={on} onChange={() => setSize(s)} className="sr-only" />
                    <span className="grid h-7 place-items-end" aria-hidden>
                      <span
                        className={cn("block rounded-[2px] border-[1.5px]", on ? "border-ink bg-sticker" : "border-ink-2 bg-wall")}
                        style={{ width: `${(landscape ? sh : sw) * 1.05 + 6}px`, height: `${(landscape ? sw : sh) * 0.85 + 6}px`, maxHeight: 28 }}
                      />
                    </span>
                    <span className="text-[15px] font-bold leading-tight">{SIZE_LABEL[s]}</span>
                    <span className="num text-[12px] leading-tight text-ink-2">
                      {landscape ? `${sh}×${sw}` : `${sw}×${sh}`} in
                    </span>
                    <span className="num text-[13px] font-semibold leading-tight">{usd(sizePrices[s].now)}</span>
                  </label>
                );
              })}
            </div>
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
          </div>

          <WallPreview
            imageUrl={art.imageUrl}
            alt={art.title}
            size={size}
            framed={framed}
            frameColor={frameColor}
            landscape={landscape}
            blur={art.sensitive.length > 0 && !sensitivePref}
          />

          {/* Buttons (desktop shows Buy here; on phones Buy is the sticky bar) */}
          <div className="grid gap-2.5">
            <button type="button" onClick={onBuy} disabled={busy} className="btn btn-blue btn-lg hidden w-full text-[18px] md:inline-flex">
              {buyLabel}
            </button>
            <button type="button" onClick={onAdd} className="btn btn-ghost w-full">
              <ShoppingBag className="h-[18px] w-[18px]" aria-hidden /> Add to cart
            </button>
            <p className="hidden items-center justify-center gap-1.5 text-[13px] text-ink-2 md:flex">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Apple Pay · Google Pay · Card
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4 text-[14px] font-semibold">
            <li className="flex items-center gap-2"><i className="paint-dab" style={{ ["--dab" as any]: "var(--af-scan)" }} />Free US shipping</li>
            <li className="flex items-center gap-2"><i className="paint-dab" style={{ ["--dab" as any]: "var(--af-sticker)" }} />Made to order</li>
            <li className="flex items-center gap-2"><i className="paint-dab" style={{ ["--dab" as any]: "var(--af-earned)" }} />{firstName} gets 60% of profit</li>
            <li className="flex items-center gap-2"><i className="paint-dab" style={{ ["--dab" as any]: "var(--af-ink)" }} />Secure checkout by Stripe</li>
          </ul>

          {art.description?.trim() && (
            <details className="group border-t border-line pt-4">
              <summary className="cursor-pointer list-none text-[15px] font-bold marker:hidden">
                About this piece <span className="font-normal text-ink-2 group-open:hidden">· show</span>
              </summary>
              <p className="mt-2 whitespace-pre-line text-[15px] text-ink-2">{art.description}</p>
            </details>
          )}
        </section>
      </div>

      {/* After the fold */}
      <section aria-label={`More by ${artist.name}`} className="mx-auto mt-10 max-w-[1240px] border-t border-line px-4 pt-8 sm:px-6 md:mt-16 md:pt-12">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-[30px] md:text-[40px]">More by {firstName}</h2>
          <div className="flex items-center gap-2">
            <Link href={`/@${artist.slug}`} className="btn btn-ghost btn-sm">See all</Link>
            <button type="button" onClick={onFollow} aria-pressed={following} className={cn("btn btn-sm", following ? "btn-ghost" : "btn-blue")}>
              {following ? "Following" : `Follow ${firstName}`}
            </button>
          </div>
        </div>
        {more.length ? (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {more.map((m) => (
              <li key={m.slug} className="w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <Link href={`/art/${m.slug}`} className="group grid gap-2 text-ink no-underline">
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

      {/* Sticky buy bar on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden">
        <button type="button" onClick={onBuy} disabled={busy} className="btn btn-blue w-full py-3.5 text-[17px]">
          {buyLabel}
        </button>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[12.5px] text-ink-2">
          <Lock className="h-3 w-3" aria-hidden /> Apple Pay · Google Pay · Card
        </p>
      </div>
    </div>
  );
}
