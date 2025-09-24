"use client"

import { useState, useEffect } from "react"

export default function AdminPayoutsPage() {
  const months = Array.from({ length: 12 }).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7) // YYYY-MM
  })

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    fetch(`/api/admin/payouts/summary?month=${month}`, {
      credentials: "include",
    })
      .then(res => res.json())
      .then(data => setRows(data.rows || []))
  }, [month])

  const markPaid = async (artistId: string, currentStatus: string) => {
    const res = await fetch("/api/admin/payouts/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artistId,
        month,
        unmark: currentStatus === "PAID", // 👈 toggle
      }),
    })
    if (res.ok) {
      // re-fetch summary after marking
      const updated = await fetch(`/api/admin/payouts/summary?month=${month}`).then(r => r.json())
      setRows(updated.rows || [])
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Payouts</h1>

      <div className="flex items-center gap-2 mb-4">
        <label htmlFor="month">Select month:</label>
        <select
          id="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {months.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Artist</th>
            <th className="p-2">Email</th>
            <th className="p-2">Venmo</th>
            <th className="p-2">Items</th>
            <th className="p-2">Gross</th>
            <th className="p-2">Expenses</th>
            <th className="p-2">Profit</th>
            <th className="p-2">Artist Share</th>
            <th className="p-2">Status</th>
            <th className="p-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.artistId} className="border-t">
              <td className="p-2">{r.artistName}</td>
              <td className="p-2">{r.artistEmail}</td>
              <td className="p-2">{r.venmoHandle}</td>
              <td className="p-2 text-center">{r.itemsCount}</td>
              <td className="p-2">${(r.gross/100).toFixed(2)}</td>
              <td className="p-2">${(r.expenses/100).toFixed(2)}</td>
              <td className="p-2">${(r.profit/100).toFixed(2)}</td>
              <td className="p-2"><strong>${(r.artistShare/100).toFixed(2)}</strong></td>
              <td className="p-2">
                {r.payout.status === "PAID"
                  ? `Paid on ${new Date(r.payout.paidAt).toLocaleDateString()}`
                  : "UNPAID"}
              </td>
              <td className="p-2">
                <button
                  onClick={() => markPaid(r.artistId, r.payout.status)}
                  className="px-3 py-1 rounded text-white bg-blue-600 hover:bg-blue-700"
                >
                  {r.payout.status === "PAID" ? "Unmark" : "Mark Paid"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
