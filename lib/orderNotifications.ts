// lib/orderNotifications.ts (server-side)
// Sends the three emails for a newly paid order: admin "new sale", one per
// artist "your artwork sold", and the buyer receipt. Safe to call repeatedly
// (Stripe retries webhooks): each email kind is claimed atomically through its
// timestamp on Order, so a retry or a concurrent delivery never resends it.
import { prisma } from "@/lib/prisma"
import { resend } from "@/lib/resend"
import { sendReceiptEmail } from "@/lib/email"
import { sendArtistReceipt } from "@/lib/artistEmails.server"
import NewSaleNotificationEmail from "@/emails/NewSaleNotificationEmail"
import ArtistSaleNotificationEmail from "@/emails/ArtistSaleNotificationEmail"

const FROM = "Artfinity <notifications@theartfinity.com>"
const ADMIN_TO = "craig@theartfinity.com"

// Resend allows 2 requests/second; 600 ms between sends stays under it.
const SEND_GAP_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Field = "adminNotificationSentAt" | "artistNotificationsSentAt"

/** Atomically set `field` if it is still null. Returns true if this call won the claim. */
async function claim(orderId: string, field: Field) {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, [field]: null },
    data: { [field]: new Date() },
  })
  return count === 1
}

/** Undo a claim so a later retry can try again (used when the send failed). */
async function release(orderId: string, field: Field) {
  await prisma.order.update({ where: { id: orderId }, data: { [field]: null } })
}

export type NotifyResult = { admin: "sent" | "skipped" | "failed"; artists: "sent" | "skipped" | "failed"; artistEmails: number; receipt: string }

export async function sendOrderNotifications(orderId: string, opts: { gapMs?: number } = {}): Promise<NotifyResult> {
  const gap = opts.gapMs ?? SEND_GAP_MS
  const result: NotifyResult = { admin: "skipped", artists: "skipped", artistEmails: 0, receipt: "skipped" }
  let sentSomething = false

  // 1) Admin "new sale" email
  if (await claim(orderId, "adminNotificationSentAt")) {
    try {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          id: true,
          email: true,
          amountTotal: true,
          items: { select: { title: true, size: true, quantity: true, unitPrice: true } },
        },
      })
      const { error } = await resend.emails.send({
        from: FROM,
        to: ADMIN_TO,
        subject: `New Sale – $${((order.amountTotal ?? 0) / 100).toFixed(2)}`,
        react: NewSaleNotificationEmail({
          orderId: order.id,
          buyerEmail: order.email,
          totalCents: order.amountTotal ?? 0,
          items: order.items.map((i) => ({
            title: i.title ?? "",
            size: i.size ?? "",
            quantity: i.quantity ?? 1,
            unitPrice: i.unitPrice ?? 0,
          })),
        }),
      })
      if (error) throw error
      result.admin = "sent"
      sentSomething = true
    } catch (err) {
      console.error("Admin sale email failed", err)
      result.admin = "failed"
      await release(orderId, "adminNotificationSentAt").catch(() => {})
    }
  }

  // 2) One "your artwork sold" email per artist
  if (await claim(orderId, "artistNotificationsSentAt")) {
    const soldItems = await prisma.orderItem.findMany({
      where: { orderId },
      select: {
        title: true,
        size: true,
        quantity: true,
        lineTotal: true,
        artwork: { select: { artist: { select: { id: true, email: true, artist_name: true } } } },
      },
    })

    // Group by artist (multi-artist orders get one email each)
    const byArtist = new Map<
      string,
      { artist: { id: string; email: string; artist_name: string | null }; items: { title: string; size: string; quantity: number; lineTotal: number }[] }
    >()
    for (const item of soldItems) {
      const artist = item.artwork?.artist
      if (!artist) continue
      const entry = byArtist.get(artist.id) ?? { artist, items: [] }
      entry.items.push({
        title: item.title ?? "",
        size: item.size ?? "",
        quantity: item.quantity ?? 1,
        lineTotal: item.lineTotal ?? 0,
      })
      byArtist.set(artist.id, entry)
    }

    let failures = 0
    for (const { artist, items } of Array.from(byArtist.values())) {
      if (sentSomething) await sleep(gap)
      try {
        const { error } = await resend.emails.send({
          from: FROM,
          to: artist.email,
          subject: "Your artwork sold on Artfinity!",
          react: ArtistSaleNotificationEmail({
            artistName: artist.artist_name ?? "Artist",
            items,
            totalCents: items.reduce((sum, i) => sum + i.lineTotal, 0),
          }),
        })
        if (error) throw error
        result.artistEmails++
        sentSomething = true
      } catch (err) {
        failures++
        console.error("Artist sale email failed", { artistId: artist.id, err })
      }
    }

    if (failures > 0 && result.artistEmails === 0) {
      // Nothing went out: let a retry try again.
      result.artists = "failed"
      await release(orderId, "artistNotificationsSentAt").catch(() => {})
    } else {
      // Keep the timestamp even on a partial failure so artists who already got
      // their email aren't emailed again; failures are logged above.
      result.artists = failures > 0 ? "failed" : "sent"
    }
  }

  // 3) Buyer receipt (its own block; idempotent inside the helper via receiptSentAt)
  try {
    if (sentSomething) await sleep(gap)
    // The artist's own receipt wording when they wrote one (single-artist orders); otherwise Artfinity's.
    const mine = await sendArtistReceipt(orderId)
    const r: any = mine === "none" ? await sendReceiptEmail(orderId) : mine === "already" ? { alreadySent: true } : {}
    result.receipt = r?.alreadySent ? "already-sent" : r?.skipped ? "skipped" : "sent"
  } catch (e) {
    console.error("Receipt email failed (non-blocking):", e)
    result.receipt = "failed"
  }

  return result
}
