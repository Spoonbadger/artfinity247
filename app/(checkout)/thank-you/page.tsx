"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

type OrderItem = {
  id: string
  title: string
  slug: string | null
  size: "small" | "medium" | "large" | string
  quantity: number
  unitPrice: number // cents
  lineTotal: number // cents
  artwork?: { imageUrl?: string | null; title?: string | null; slug?: string | null; artist?: { name?: string | null } | null } | null
}
type Order = {
  id: string
  createdAt: string
  email: string | null
  amountTotal: number // cents
  currency: string | null
  paymentStatus: string | null
  receiptSentAt?: string | null
  shippingName?: string | null
  shippingAddress?: string | null
  items: OrderItem[]
}

export default function ThankYouPage() {
  const sp = useSearchParams()
  const sessionId = sp.get("session_id") || ""
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) { setErr("Missing session"); setLoading(false); return }
    (async () => {
      try {
        const res = await fetch(`/api/thank-you?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
        if (!res.ok) throw new Error((await res.json()).message || "Failed")
        const data: Order = await res.json()
        setOrder(data)
      } catch (e: any) {
        setErr(e.message || "Order not found")
      } finally {
        setLoading(false)
      }
    })()
  }, [sessionId])

  const fmt = (cents: number, currency = order?.currency || "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100)

  if (loading) return <div className="p-6">Processing your order…</div>
  if (err) return <div className="p-6">Order is still processing. Refresh in a moment.</div>
  if (!order) return null

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Thank you for your order!</h1>
      <p className="text-sm text-muted-foreground">
        Confirmation code: <span className="font-mono">{order.id}</span>
      </p>
      {order.receiptSentAt ? (
        <p className="text-sm">Receipt sent to: {order.email}</p>
      ) : order.email ? (
        <p className="text-sm text-muted-foreground">
          We’ll email your receipt shortly to {order.email}
        </p>
      ) : null}

      {(order.shippingName || order.shippingAddress) && (
        <div className="mt-4">
          <h2 className="font-medium">Shipping To</h2>
          {order.shippingName && <p>{order.shippingName}</p>}
          {order.shippingAddress && <p>{order.shippingAddress}</p>}
        </div>
      )}


      <div className="mt-4 rounded border p-4">
        <h2 className="mb-3 text-lg font-medium">Order summary</h2>
        <ul className="divide-y">
          {order.items.map((it) => (
            <li key={it.id} className="flex gap-3 py-3">
              {it.artwork?.imageUrl ? (
                <img
                  src={it.artwork.imageUrl}
                  alt={it.title || it.artwork?.title || ""}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : null}
              <div className="flex-1">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-muted-foreground">
                  Size: {it.size} • Qty: {it.quantity}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm">{fmt(it.unitPrice)}</div>
                <div className="text-xs text-muted-foreground">Line: {fmt(it.lineTotal)}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end border-t pt-4">
          <div className="text-right">
            <div className="text-sm">Status: {order.paymentStatus || "paid"}</div>
            <div className="text-lg font-semibold">Total: {fmt(order.amountTotal)}</div>
          </div>
        </div>
      </div>

      <a href="/" className="underline">Continue browsing</a>
    </div>
  )
}
