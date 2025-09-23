"use client"

import { useEffect, useState } from "react"

type PurchaseItem = {
  id: string
  slug: string | null
  size: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  title: string | null
  artistName: string | null
  imageUrl: string | null
  order: {
    id: string
    createdAt: string
    email: string | null
    paymentStatus: string | null
    currency: string | null
    shippingStatus: string
  }
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/my-purchases", {
          cache: "no-store",
          credentials: "include",
        })
        if (res.ok) {
          const data: PurchaseItem[] = await res.json()
          setPurchases(data)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const fmt = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      cents / 100
    )

  if (loading) return <div className="p-6">Loading purchases…</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">My Purchases</h1>
      {purchases.length === 0 ? (
        <p>You haven’t bought anything yet.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Artwork</th>
              <th className="p-2">Artist</th>
              <th className="p-2">Date</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Size</th>
              <th className="p-2">Total</th>
              <th className="p-2">Status</th>
              <th className="p-2">Shipping</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2 flex items-center gap-2">
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.title || ""}
                      className="w-10 h-10 object-cover rounded"
                    />
                  )}
                  <span>{p.title}</span>
                </td>
                <td className="p-2">{p.artistName || "Unknown"}</td>
                <td className="p-2">
                  {new Date(p.order.createdAt).toLocaleDateString()}
                </td>
                <td className="p-2 text-center">{p.quantity}</td>
                <td className="p-2 text-center">{p.size}</td>
                <td className="p-2 text-right">
                  {fmt(p.lineTotal, p.order.currency || "USD")}
                </td>
                <td className="p-2 text-center">{p.order.paymentStatus}</td>
                <td className="p-2 text-center">{p.order.shippingStatus || "pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
