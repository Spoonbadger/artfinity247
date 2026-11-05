// /order/[orderId]/help?t=<sig> — "Problem with your print?" from the shipped/delivered emails and the order page.
// The signed link stands in for a buyer account (lib/reprints.ts). Open from shipping until about 14 days after delivery.
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requestsForOrder, shippedAtFor, verifyHelp } from "@/lib/reprints";
import { helpDeadline, helpState, reasonLabel } from "@/lib/reprintFormat";
import { sizeWords } from "@/lib/artistEmails";
import { BrushStroke } from "@/components/af/Brush";
import HelpForm, { type HelpItem } from "@/components/reprints/HelpForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Problem with your print?", robots: { index: false, follow: false } };

type Props = { params: { orderId: string }; searchParams: { t?: string } };

const WriteToUs = () => (
  <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">write to us</Link>
);

function Note({ title, children, thumbs, badge }: { title: string; children: React.ReactNode; thumbs?: { id: string; imageUrl: string }[]; badge?: string }) {
  return (
    <div className="mx-auto grid max-w-[520px] justify-items-center gap-4 px-4 py-14 text-center sm:py-24">
      {thumbs && thumbs.length > 0 && (
        <div className="flex justify-center -space-x-3 pb-2">
          {thumbs.slice(0, 3).map((it, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={it.id} src={it.imageUrl} alt="" className="h-24 w-[76px] rounded-[2px] border-4 border-white object-cover shadow-[0_10px_24px_-12px_rgba(21,22,27,.6)]" style={{ transform: `rotate(${[-5, 3, -2][i]}deg)` }} />
          ))}
        </div>
      )}
      {badge && <span className="sticker-badge">{badge}</span>}
      <h1 className="display text-[38px] leading-[1.02] sm:text-[48px]">{title}</h1>
      <div className="grid gap-3 text-[17px] text-ink-2">{children}</div>
    </div>
  );
}

const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric" });

export default async function HelpPage({ params, searchParams }: Props) {
  const orderId = params.orderId;
  const order = verifyHelp(orderId, searchParams.t)
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, kind: true, paymentStatus: true, shippingStatus: true, createdAt: true, shippingName: true,
          items: {
            orderBy: { id: "asc" },
            select: { id: true, title: true, imageUrl: true, artistName: true, size: true, frameChosen: true, quantity: true, artwork: { select: { title: true, imageUrl: true } } },
          },
        },
      })
    : null;

  if (!order) {
    return (
      <Note title="This link doesn't look right">
        <p>Use the link in your email from Artfinity. If it still won&apos;t open, <WriteToUs /> with your order number and a photo. We&apos;ll sort it.</p>
      </Note>
    );
  }

  const thumbs = order.items.map((i) => ({ id: i.id, imageUrl: i.artwork?.imageUrl || i.imageUrl || "" }));
  const [shippedAt, requests] = await Promise.all([shippedAtFor(order.id), requestsForOrder(order.id)]);
  const latest = requests[requests.length - 1];

  if (latest) {
    const d = latest.body.decision;
    const copy = {
      open: { badge: "Request received", title: "We have your photos", body: <p>We&apos;ll look today or tomorrow and email you. If it&apos;s on us, we reprint it free.</p> },
      approved: { badge: "Approved", title: "Your free reprint is on its way", body: <p>We&apos;re printing it again and will email tracking when it ships. No need to send the old one back.</p> },
      refunded: { badge: "Refunded", title: "We've refunded you", body: <p>It goes back to your original payment method and can take 5 to 10 days to show.</p> },
      declined: { badge: "We looked closely", title: "We can't reprint this one", body: <p>If we got it wrong, <WriteToUs /> and tell us more.</p> },
    }[latest.status];
    return (
      <Note title={copy.title} badge={copy.badge} thumbs={thumbs}>
        {copy.body}
        {d?.note && latest.status !== "open" && <p className="af-panel mx-auto w-fit max-w-full whitespace-pre-line px-4 py-3 text-left text-[15.5px] text-ink">{d.note}</p>}
        <p className="text-[14px]">{reasonLabel(latest.body.reason)} · sent {fmt(latest.createdAt)}</p>
      </Note>
    );
  }

  const state = helpState(order, shippedAt);
  if (state === "never") {
    return <Note title="Nothing to fix here">This order doesn&apos;t take reprint requests. Questions? <WriteToUs />.</Note>;
  }
  if (state === "waiting") {
    return (
      <Note title="Your print hasn't shipped yet" thumbs={thumbs}>
        <p>Once it arrives, this page is where you tell us if anything&apos;s wrong. Something already off? <WriteToUs />.</p>
      </Note>
    );
  }
  if (state === "closed") {
    return (
      <Note title="It's been a while" thumbs={thumbs}>
        <p>Free reprints are for problems sent within 14 days of delivery. Still, <WriteToUs /> with a photo and we&apos;ll see what we can do.</p>
      </Note>
    );
  }

  const items: HelpItem[] = order.items.map((i) => ({
    id: i.id,
    title: i.artwork?.title || i.title || "Your print",
    imageUrl: i.artwork?.imageUrl || i.imageUrl || "",
    detail: [sizeWords(i.size).split(",")[0], i.frameChosen ? "framed" : "", i.artistName ? `by ${i.artistName}` : ""].filter(Boolean).join(" · "),
    quantity: i.quantity ?? 1,
  }));
  const first = (order.shippingName || "").trim().split(/\s+/)[0];

  return (
    <div className="bg-wall">
      <div className="mx-auto grid max-w-[620px] gap-6 px-4 pb-20 pt-8 sm:pt-12">
        <header className="grid gap-2">
          <span className="sticker-badge w-fit">Free reprint</span>
          <h1 className="display text-[40px] leading-[1.0] sm:text-[54px]">
            {first ? `Sorry, ${first}. ` : "Sorry. "}Let&apos;s{" "}
            <span className="relative z-0 whitespace-nowrap">
              fix it.
              <BrushStroke className="absolute -bottom-1 -left-1 -z-10 h-3 w-[calc(100%+8px)]" />
            </span>
          </h1>
          <p className="text-[16.5px] text-ink-2">
            Damaged, misprinted or wrong? Send a photo and we reprint it free. The artist still gets paid. Open until {fmt(helpDeadline(order, shippedAt))}.
          </p>
        </header>
        <HelpForm orderId={order.id} token={String(searchParams.t)} items={items} />
      </div>
    </div>
  );
}
