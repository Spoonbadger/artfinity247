// /collector — "Your collection": a signed-in buyer's orders (matched by their verified email), the artists they follow,
// their wishlist and, when switched on, reward progress. Optional: buying never needs it (lib/collector.ts).
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ordersWhere, requireCollector } from "@/lib/collector";
import { rewardStatus } from "@/lib/collectorRewards";
import { trackingForOrders } from "@/lib/shipping/store";
import { certPathsFor } from "@/lib/certificates";
import { helpPath } from "@/lib/reprints";
import { reviewPath, reviewState } from "@/lib/reviews";
import { editionsFor } from "@/lib/editions";
import { editionLabel } from "@/lib/editionFormat";
import { frameText, friendlySize, orderCode } from "@/lib/orderText";
import { PRINT_SIZES, priceFor, usd } from "@/components/art/pricing";
import { sizeAllowed } from "@/lib/printSizes";
import { artistPath, artPath } from "@/lib/urls";
import { BrushStroke } from "@/components/af/Brush";
import { FollowToggle, RemoveSaved, SignOutButton } from "@/components/collector/CollectorActions";
import { cn } from "@/lib/utils";
import { UrlPicker } from "@/components/money/SortSelect";

const ORDER_SORTS = [{ value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" }, { value: "price", label: "Price" }];
const SAVED_SORTS = [{ value: "newest", label: "Recently saved" }, { value: "price", label: "Price, low to high" }, { value: "title", label: "Title, A–Z" }];

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your collection", robots: { index: false, follow: false } };

const day = (d: Date | null | undefined) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : null);
const displayName = (a: { artist_name: string | null; name: string }) => a.artist_name?.trim() || a.name;

function Section({ id, title, count, children, action }: { id: string; title: string; count?: number; children: React.ReactNode; dab?: string; action?: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="t-section flex items-baseline gap-2.5">
          {title}
          {count ? <span className="num font-body text-[16px] font-semibold text-ink-2">{count}</span> : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children, cta }: { children: React.ReactNode; cta?: { href: string; label: string } }) {
  return (
    <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-line bg-wall/60 p-6">
      <p className="t-body text-ink-2">{children}</p>
      {cta && <Link href={cta.href} className="btn btn-ghost btn-sm min-h-[44px] px-4">{cta.label}</Link>}
    </div>
  );
}

const STEPS = ["Paid", "Printing", "Shipped", "Delivered"] as const;

function Timeline({ step, dates, tracking }: { step: number; dates: (string | null)[]; tracking: { carrier: string; number: string; url: string | null } | null }) {
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Order status">
      {STEPS.map((label, i) => {
        const done = i <= step;
        return (
          <li key={label} className="grid content-start gap-1" aria-current={i === step ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full", done ? "bg-scan" : "bg-line")} aria-hidden />
            <span className={cn("text-[13px] font-semibold leading-tight", done ? "text-ink" : "text-ink-2")}>
              {label}
              <span className="sr-only">{done ? " (done)" : " (not yet)"}</span>
            </span>
            {done && dates[i] && <span className="num text-[13px] leading-tight text-ink-2">{dates[i]}</span>}
            {i === 2 && done && tracking && (
              tracking.url ? (
                <a href={tracking.url} target="_blank" rel="noopener" className="text-[13px] font-semibold text-scan underline underline-offset-2">
                  Track<span className="sr-only"> package ({tracking.carrier} {tracking.number})</span>
                </a>
              ) : (
                <span className="num break-all text-[13px] text-ink-2">{tracking.carrier} {tracking.number}</span>
              )
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function CollectorPage({ searchParams }: { searchParams: { sort?: string; wsort?: string } }) {
  const me = await requireCollector("/collector");

  const [orders, follows, saved, rewards] = await Promise.all([
    prisma.order.findMany({
      where: ordersWhere(me.email),
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, stripeSessionId: true, createdAt: true, amountTotal: true, paymentStatus: true, shippingStatus: true, kind: true,
        sentToPrinter: true, printerSentAt: true, shippedAt: true, deliveredAt: true, trackingCarrier: true, trackingNumber: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true, title: true, imageUrl: true, size: true, frameChosen: true, frameColor: true, quantity: true, editionNumber: true, artistName: true,
            artwork: { select: { title: true, imageUrl: true, slug: true, editionSize: true, artist: { select: { slug: true, name: true, artist_name: true } } } },
          },
        },
      },
    }),
    prisma.follower.findMany({
      where: { email: { equals: me.email, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, confirmedAt: true, unsubscribedAt: true, artist: { select: { slug: true, name: true, artist_name: true, profileImage: true, city: true, closedAt: true } } },
    }),
    prisma.wishlistItem.findMany({
      where: { collectorId: me.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        artwork: {
          select: {
            id: true, slug: true, title: true, imageUrl: true, status: true, editionSize: true, printableSizes: true,
            markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
            artist: { select: { slug: true, name: true, artist_name: true, closedAt: true, suspendedAt: true } },
          },
        },
      },
    }),
    rewardStatus(me.email),
  ]);

  const [tracking, certs, editions] = await Promise.all([
    trackingForOrders(orders),
    certPathsFor(orders.filter((o) => o.paymentStatus === "paid").flatMap((o) => o.items.map((i) => i.id))),
    editionsFor(saved.map((s) => ({ id: s.artwork.id, editionSize: s.artwork.editionSize ?? null }))),
  ]);

  const r = rewards.settings.enabled ? rewards : null;
  const sort = ORDER_SORTS.some((o) => o.value === searchParams.sort) ? searchParams.sort! : "newest";
  if (sort === "oldest") orders.reverse();
  if (sort === "price") orders.sort((a, b) => (b.amountTotal || 0) - (a.amountTotal || 0));
  const wsort = SAVED_SORTS.some((o) => o.value === searchParams.wsort) ? searchParams.wsort! : "newest";
  const fromPrice = (a: (typeof saved)[number]["artwork"]) => {
    const sizes = PRINT_SIZES.filter((s) => sizeAllowed(a.printableSizes, s));
    return Math.min(...(sizes.length ? sizes : PRINT_SIZES).map((s) => priceFor(a, s).list));
  };
  if (wsort === "price") saved.sort((x, y) => fromPrice(x.artwork) - fromPrice(y.artwork));
  if (wsort === "title") saved.sort((x, y) => x.artwork.title.localeCompare(y.artwork.title));
  const firstName = me.name?.split(" ")[0];

  return (
    <div className="mx-auto grid max-w-[980px] gap-10 px-4 pb-16 pt-8 sm:px-6 md:gap-14 md:pt-12">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid min-w-0 gap-2">
            <h1 className="display relative inline-block text-[46px] sm:text-[64px]">
              <span className="relative z-10">{firstName ? `${firstName}'s collection` : "Your collection"}</span>
              <BrushStroke className="absolute -bottom-1 left-0 z-0 h-[0.32em] w-[min(100%,5.5em)] opacity-90" color="var(--af-sticker)" />
            </h1>
            <p className="t-small [overflow-wrap:anywhere]">Signed in as {me.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/collector/settings" className="btn btn-ghost btn-sm min-h-[44px] px-4">Settings</Link>
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Sections" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-[14.5px] font-semibold sm:mx-0 sm:px-0">
          <a href="#orders" className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-ink no-underline hover:border-ink">Orders · {orders.length}</a>
          <a href="#following" className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-ink no-underline hover:border-ink">Following · {follows.filter((f) => f.confirmedAt && !f.unsubscribedAt).length}</a>
          <a href="#wishlist" className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-ink no-underline hover:border-ink">Wishlist · {saved.length}</a>
        </nav>
      </header>

      {r && (
        <aside aria-label="Rewards" className="relative grid gap-3 overflow-hidden rounded-[22px] border-[1.5px] border-ink bg-[radial-gradient(ellipse_at_10%_0%,#fff7d6_0%,#ffffff_60%)] p-5 shadow-[5px_5px_0_#15161b] sm:p-6">
          {r.available ? (
            <>
              <p className="text-[22px] font-extrabold leading-tight">{r.available.pct}% off your next order</p>
              <p className="text-[15px] text-ink-2">
                Code <b className="num tracking-[0.06em] text-ink">{r.available.code}</b>. It&apos;s filled in at checkout while you&apos;re signed in. Artfinity covers it, so the artist still gets their full share.
              </p>
            </>
          ) : (
            <>
              <p className="text-[20px] font-extrabold leading-tight">
                {r.progress} of {r.settings.every} prints toward your reward
              </p>
              <p className="text-[15px] text-ink-2">Every {r.settings.every}th print earns {r.settings.pct}% off your next order. We&apos;ll email you a code.</p>
            </>
          )}
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: r.settings.every }, (_, i) => (
              <span key={i} className={cn("h-3 flex-1 rounded-full", r.available || i < r.progress ? "bg-sticker" : "bg-line")} />
            ))}
          </div>
        </aside>
      )}

      <Section id="orders" title="Orders" count={orders.length} dab="var(--af-scan)" action={orders.length > 1 ? <UrlPicker param="sort" label="Sort orders" value={sort} options={ORDER_SORTS} storageKey="af:collector:orders-sort" /> : undefined}>
        {orders.length === 0 ? (
          <Empty cta={{ href: "/art", label: "Browse art" }}>No orders for {me.email} yet. When you buy with this email, the order shows up here, even as a guest.</Empty>
        ) : (
          <ul className="grid gap-4">
            {orders.map((o) => {
              const paid = o.paymentStatus === "paid";
              const step = o.shippingStatus === "delivered" ? 3 : o.shippingStatus === "shipped" ? 2 : o.sentToPrinter || o.printerSentAt ? 1 : 0;
              const shipped = step >= 2;
              const rs = reviewState(o);
              const t = tracking.get(o.id) ?? null;
              return (
                <li key={o.id} className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[14px] text-ink-2">
                      <b className="text-ink">Order {orderCode(o.id)}</b> · {day(o.createdAt)}, {o.createdAt.getFullYear()}
                    </p>
                    <p className="num text-[15px] font-semibold">{usd(o.amountTotal)}</p>
                  </div>
                  <ul className="grid gap-3">
                    {o.items.map((it) => {
                      const a = it.artwork;
                      const title = a?.title || it.title || "Print";
                      const artist = a?.artist ? displayName(a.artist) : it.artistName;
                      const href = a?.slug && a.artist?.slug ? artPath(a.artist.slug, a.slug) : null;
                      const cert = certs.get(it.id);
                      return (
                        <li key={it.id} className="flex gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a?.imageUrl || it.imageUrl || ""} alt="" className="h-[76px] w-[60px] shrink-0 rounded-[2px] bg-gallery object-cover shadow-[0_8px_16px_-10px_rgba(21,22,27,.6)]" />
                          <div className="min-w-0 leading-snug">
                            {href ? <Link href={href} className="block truncate font-bold text-ink no-underline hover:underline">{title}</Link> : <b className="block truncate">{title}</b>}
                            {artist && <span className="block text-[13.5px] text-ink-2">by {artist}</span>}
                            <span className="block text-[13.5px] text-ink-2">
                              {[friendlySize(it.size), frameText(it.frameChosen, it.frameColor) ?? "No frame", (it.quantity ?? 1) > 1 ? `× ${it.quantity}` : null].filter(Boolean).join(" · ")}
                            </span>
                            {it.editionNumber && a?.editionSize ? <span className="mt-1 inline-block rounded-full bg-sticker px-2 py-0.5 text-[12px] font-bold">{editionLabel(it.editionNumber, it.quantity, a.editionSize)}</span> : null}
                            {cert && (
                              <a href={cert} target="_blank" rel="noopener" className="mt-1 block w-fit text-[13.5px] font-semibold text-scan underline-offset-2 hover:underline">
                                Certificate of authenticity<span className="sr-only"> for {title}</span>
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {paid ? (
                    <Timeline step={step} dates={[day(o.createdAt), day(o.printerSentAt), day(o.shippedAt), day(o.deliveredAt)]} tracking={t} />
                  ) : (
                    <p className="text-[14px] font-semibold text-ink-2">Payment {o.paymentStatus || "pending"}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-dashed border-line pt-3 text-[14px]">
                    <Link href={`/thank-you?session_id=${encodeURIComponent(o.stripeSessionId)}`} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                      Receipt<span className="sr-only"> for order {orderCode(o.id)}</span>
                    </Link>
                    {rs === "open" && (
                      <Link href={reviewPath(o.id)} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                        Leave a review<span className="sr-only"> for order {orderCode(o.id)}</span>
                      </Link>
                    )}
                    {rs === "waiting" && paid && <span className="text-ink-2">Reviews open once it arrives</span>}
                    {shipped && paid && (
                      <Link href={helpPath(o.id)} className="font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                        Problem with the print?<span className="sr-only"> Order {orderCode(o.id)}</span>
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="following" title="Following" dab="var(--af-coral)">
        {follows.length === 0 ? (
          <Empty cta={{ href: "/artists", label: "Find artists" }}>You&apos;re not following anyone yet. Tap Follow on an artist&apos;s page to hear when they post new work.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {follows.map((f) => {
              const a = f.artist;
              const name = displayName(a);
              const on = !!f.confirmedAt && !f.unsubscribedAt;
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                  <span className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-full bg-wall">
                    {a.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-sm font-bold" aria-hidden>{name[0]}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    {a.closedAt ? <b className="block truncate">{name}</b> : <Link href={artistPath(a.slug)} className="block truncate font-bold text-ink no-underline hover:underline">{name}</Link>}
                    <span className="text-[13px] text-ink-2">{on ? "Following" : f.unsubscribedAt ? "Unsubscribed" : "Not confirmed yet"}{a.city ? ` · ${a.city}` : ""}</span>
                  </div>
                  {!a.closedAt && <FollowToggle id={f.id} following={on} name={name} />}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id="wishlist" title="Wishlist" count={saved.length} dab="var(--af-sticker)" action={saved.length > 1 ? <UrlPicker param="wsort" label="Sort wishlist" value={wsort} options={SAVED_SORTS} storageKey="af:collector:wishlist-sort" /> : undefined}>
        {saved.length === 0 ? (
          <Empty cta={{ href: "/art", label: "Browse art" }}>Nothing saved yet. Tap the heart on any painting to keep it here.</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
            {saved.map(({ id, artwork: a }) => {
              const live = a.status === "APPROVED" && !a.artist.closedAt && !a.artist.suspendedAt && !!a.slug;
              const sizes = PRINT_SIZES.filter((s) => sizeAllowed(a.printableSizes, s));
              const from = Math.min(...(sizes.length ? sizes : PRINT_SIZES).map((s) => priceFor(a, s).list));
              const ed = editions.get(a.id);
              const href = live ? artPath(a.artist.slug, a.slug!) : null;
              return (
                <li key={id} className="grid min-w-0 content-start gap-2">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-wall p-[10%]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.title} loading="lazy" className={cn("mx-auto h-full w-full bg-white object-contain shadow-[0_12px_24px_-6px_rgba(21,22,27,.35)]", (!live || ed?.soldOut) && "opacity-60 grayscale-[40%]")} />
                    {ed?.soldOut && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[12px] font-bold text-white">Sold out</span>}
                    {ed && !ed.soldOut && <span className="absolute left-2 top-2 rounded-full bg-sticker px-2 py-0.5 text-[12px] font-bold">{ed.left} of {ed.size} left</span>}
                  </div>
                  <div className="grid min-w-0 gap-0.5 px-0.5 leading-tight">
                    {href ? <Link href={href} className="truncate font-semibold text-ink no-underline hover:underline">{a.title}</Link> : <b className="truncate">{a.title}</b>}
                    <span className="truncate text-[13.5px] text-ink-2">{displayName(a.artist)}</span>
                    <span className="num text-[13.5px] text-ink-2">{!live ? "No longer available" : ed?.soldOut ? "Edition sold out" : <>from <b className="font-semibold text-ink">{usd(from)}</b></>}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {href && !ed?.soldOut && <Link href={href} className="btn btn-blue btn-sm min-h-[40px] px-4" aria-label={`Buy ${a.title}`}>Buy</Link>}
                    <RemoveSaved artworkId={a.id} title={a.title} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <p className="text-[14px] text-ink-2">
        You only ever see orders placed with {me.email}. <Link href="/help/buyers/orders-and-wishlist" className="font-semibold text-ink underline underline-offset-4">How your collection works</Link>
      </p>
    </div>
  );
}
