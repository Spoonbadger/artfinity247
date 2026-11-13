// Server half of lib/artistEmails.ts: looks up an artist's template and builds order variables.
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { renderArtistEmail, emailHtml, firstNameOf, joinTitles, sizeWords, type EmailKind, type EmailVars, type RenderedEmail } from "@/lib/artistEmails";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const FROM_ADDRESS = "notifications@theartfinity.com";

export const orderLink = (stripeSessionId: string) => `${APP_URL}/thank-you?session_id=${encodeURIComponent(stripeSessionId)}`;

/** Strips characters that would break a "Name <address>" header. */
export const safeFromName = (name: string) => name.replace(/[<>"\r\n,;]/g, "").trim().slice(0, 60) || "Artfinity";

export async function getArtistTemplate(artistId: string, kind: EmailKind) {
  return prisma.emailTemplate.findUnique({ where: { artistId_kind: { artistId, kind } } });
}

type OrderForEmail = {
  id: string;
  stripeSessionId: string;
  email: string;
  shippingName: string | null;
  items: { title: string | null; size: string | null; artwork: { title: string; artist: { id: string; artist_name: string | null; name: string } } | null }[];
};

async function loadOrder(orderId: string): Promise<OrderForEmail | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, stripeSessionId: true, email: true, shippingName: true,
      items: { select: { title: true, size: true, artwork: { select: { title: true, artist: { select: { id: true, artist_name: true, name: true } } } } } },
    },
  });
}

/**
 * The artist's own email for this order, or null when Artfinity's default should be used:
 * the order has items from more than one artist, or the artist has no enabled template.
 */
export async function artistEmailForOrder(orderId: string, kind: EmailKind): Promise<(RenderedEmail & { to: string; fromName: string }) | null> {
  const order = await loadOrder(orderId);
  if (!order?.email) return null;
  const artists = new Map(order.items.filter((i) => i.artwork).map((i) => [i.artwork!.artist.id, i.artwork!.artist]));
  if (artists.size !== 1) return null;
  const artist = Array.from(artists.values())[0];
  const template = await getArtistTemplate(artist.id, kind);
  if (!template?.enabled) return null;

  const artistName = artist.artist_name || artist.name || "Your artist";
  const vars: EmailVars = {
    buyer_first_name: firstNameOf(order.shippingName),
    artwork_title: joinTitles(order.items.map((i) => i.artwork?.title || i.title || "")),
    artist_name: artistName,
    order_link: orderLink(order.stripeSessionId),
    size: sizeWords(order.items[0]?.size),
  };
  const rendered = renderArtistEmail(kind, template, vars);
  if (!rendered.custom) return null;
  return { ...rendered, to: order.email, fromName: `${safeFromName(artistName)} via Artfinity` };
}

/**
 * Sends the artist's version of a shipped/delivered email. Returns true if it went out,
 * false if the caller should send Artfinity's default instead.
 */
export async function sendArtistOrderEmail(orderId: string, kind: EmailKind, opts: { append?: string } = {}): Promise<boolean> {
  const email = await artistEmailForOrder(orderId, kind);
  if (!email) return false;
  // `append` adds Artfinity's lines (e.g. tracking) under the artist's own words.
  const body = opts.append ? `${email.body}\n\n${opts.append}` : null;
  const footer = "Sent with Artfinity. From paint to print.";
  const { error } = await resend.emails.send({
    from: `${email.fromName} <${FROM_ADDRESS}>`,
    to: email.to,
    subject: email.subject,
    html: body ? emailHtml(body, footer) : email.html,
    text: body ? `${body}\n\n--\n${footer}` : email.text,
  });
  if (error) throw error;
  console.log(`[artist-email] order=${orderId} kind=${kind} template=artist`);
  return true;
}

const usd = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Buyer receipt in the artist's words, with the order summary underneath.
 * "none": no artist template applies, send Artfinity's receipt. "already": a receipt went out before.
 * Claims Order.receiptSentAt atomically so the default receipt is never sent as well.
 */
export async function sendArtistReceipt(orderId: string): Promise<"sent" | "none" | "already"> {
  const email = await artistEmailForOrder(orderId, "receipt");
  if (!email) return "none";
  const { count } = await prisma.order.updateMany({ where: { id: orderId, receiptSentAt: null }, data: { receiptSentAt: new Date() } });
  if (count !== 1) return "already";
  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { amountTotal: true, items: { select: { title: true, size: true, quantity: true, lineTotal: true, unitPrice: true } } },
    });
    const lines = order.items.map((i) => {
      const qty = i.quantity ?? 1;
      return `${i.title || "Print"}, ${sizeWords(i.size) || i.size || ""}${qty > 1 ? ` × ${qty}` : ""}: ${usd(i.lineTotal ?? (i.unitPrice ?? 0) * qty)}`;
    });
    const summary = `Your order\n${lines.join("\n")}\nTotal: ${usd(order.amountTotal ?? 0)}`;
    const body = `${email.body}\n\n${summary}`;
    const footer = "Sent with Artfinity. From paint to print.";
    const { error } = await resend.emails.send({
      from: `${email.fromName} <${FROM_ADDRESS}>`,
      to: email.to,
      subject: email.subject,
      html: emailHtml(body, footer),
      text: `${body}\n\n--\n${footer}`,
    });
    if (error) throw error;
    console.log(`[artist-email] order=${orderId} kind=receipt template=artist`);
    return "sent";
  } catch (err) {
    await prisma.order.update({ where: { id: orderId }, data: { receiptSentAt: null } }).catch(() => {});
    throw err;
  }
}
