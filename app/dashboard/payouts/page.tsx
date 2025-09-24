"use client"

import { useEffect, useState } from "react"

type Payout = {
  month: string
  amountCents: number
  paidAt: string | null
  createdAt: string
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/artist/payouts/history", {
          cache: "no-store",
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          setPayouts(data.payouts || [])
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const fmt = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100)

  if (loading) return <div className="p-6">Loading payout history…</div>

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Payout History</h1>
      {payouts.length === 0 ? (
        <p>No payouts recorded yet.</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Month</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-center">Status</th>
              <th className="p-2 text-center">Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{p.month}</td>
                <td className="p-2 text-right">{fmt(p.amountCents)}</td>
                <td className="p-2 text-center">
                  {p.paidAt ? "Paid" : "Unpaid"}
                </td>
                <td className="p-2 text-center">
                  {p.paidAt
                    ? new Date(p.paidAt).toLocaleDateString()
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-4 text-xs text-gray-500">
        Expenses include materials, packaging, and website costs. Payments are
        sent by the 5th of each month.
      </p>
    </div>
  )
}