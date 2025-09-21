"use client"

import { useEffect, useState } from 'react'

type SaleItem = {
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
  }
}


export default function SalesPage() {
    const [sales, setSales] = useState<SaleItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      (async () => {
        try {
          const res = await fetch('/api/my-sales', { 
            cache: 'no-store',
            credentials: "include",
        })
            if (res.ok) {
              const data: SaleItem[] = await res.json()
              setSales(data)
            }
          } finally {
            setLoading(false)
          }
        })()
    }, [])
    const fmt = (cents: number, currency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)

  if (loading) return <div className="p-6">Loading sales…</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">My Sales</h1>
      {sales.length === 0 ? (
        <p>No sales yet.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Artwork</th>
              <th className="p-2">Buyer</th>
              <th className="p-2">Date</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Size</th>
              <th className="p-2">Total</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-2 flex items-center gap-2">
                  {s.imageUrl && (
                    <img src={s.imageUrl} alt={s.title || ""} className="w-10 h-10 object-cover rounded" />
                  )}
                  <span>{s.title}</span>
                </td>
                <td className="p-2">{s.order.email}</td>
                <td className="p-2">
                  {new Date(s.order.createdAt).toLocaleDateString()}
                </td>
                <td className="p-2 text-center">{s.quantity}</td>
                <td className="p-2 text-center">{s.size}</td>
                <td className="p-2 text-right">{fmt(s.lineTotal, s.order.currency || "USD")}</td>
                <td className="p-2 text-center">{s.order.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}