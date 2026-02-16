"use client"

import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { useEffect, useState } from 'react'

export const dynamic = "force-dynamic"

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

const months = Array.from({ length: 12 }).map((_, i) => {
  const d = new Date()
  d.setMonth(d.getMonth() - i)
  return d.toISOString().slice(0, 7) // YYYY-MM
})


export default function SalesPage() {
    const [sales, setSales] = useState<SaleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
    const [report, setReport] = useState<any>(null)

    const params = new URLSearchParams(window.location.search)
    const slug = params.get("slug")

    const fetchReport = async () => {
      const res = await fetch(`/api/artist/payouts?month=${month}`)
      if (!res.ok) return alert("Could not fetch")
      setReport(await res.json())
    }

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
      <div className="flex gap-2 mb-4">
        <select value={month} onChange={e => setMonth(e.target.value)}>
          {months.map(m => <option key={m}>{m}</option>)}
        </select>
        <button
          onClick={fetchReport}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          View Report
        </button>
        <h1 className="text-2xl font-semibold mb-4 flex items-center justify-between">
          <a
            href="/dashboard/payouts"
            className="px-10 text-blue-600 text-sm underline hover:no-underline"
          >View Payout History →
          </a>
        </h1>

      </div>

      {report && (
        <div className="space-y-2">
          <div><strong>Gross:</strong> ${(report.gross/100).toFixed(2)}</div>
          <div><strong>Expenses:</strong> ${(report.expenses/100).toFixed(2)} (materials, packaging, website costs)</div>
          <div><strong>Profit:</strong> ${(report.profit/100).toFixed(2)}</div>
          <div><strong>Your Share:</strong> <u>${(report.artistShare/100).toFixed(2)}</u></div>
          payments are made by the 5th of each month
          <div><br></br></div>
        </div>
      )}
      <Link className="hover:underline" href={`/artists/${slug}`}>
        Back to profile
      </Link>
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