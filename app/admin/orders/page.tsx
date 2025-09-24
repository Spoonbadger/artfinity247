'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type OrderItem = {
  id: string
  slug: string | null
  size: string | null
  quantity: number | null
  unitPrice: number | null
  lineTotal: number | null
  printCost: number | null
  shippingCost: number | null
  laborCost: number | null
  websiteCost: number | null
  profit: number
  artistShare: number
  companyShare: number
  artwork: {
    artistId: string
  }
}

type Order = {
  id: string
  stripeSessionId: string
  email: string | null
  amountTotal: number | null
  currency: string | null
  paymentStatus: string
  createdAt: string
  shippingStatus: string
  items: OrderItem[]
}


export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // current month YYYY-MM
  )

  const months = ["all", ...Array.from({ length: 12 }).map((_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7) // YYYY-MM
  })]

  useEffect(() => {
    const url = selectedMonth === "all"
      ? "/api/admin/orders"
      : `/api/admin/orders?month=${selectedMonth}`

    fetch(url)
      .then(res => res.json())
      .then(setOrders)
  }, [selectedMonth])


  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shippingStatus: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      setOrders(prev =>
        prev.map(o =>
          o.id === orderId ? { ...o, shippingStatus: newStatus } : o
        )
      )
    } catch (err) {
      console.error(err)
      alert('Could not update shipping status')
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Orders View</h1>
      <div className="flex items-center gap-2 mb-4">
        <label htmlFor="month" className="font-medium">Select month:</label>
        <select
          id="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border rounded px-2 py-1"
        >
          {months.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <Link
          href={`/api/admin/payouts?month=${selectedMonth}`}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Export CSV
        </Link>
      </div>
      <div className="space-y-4">
        {orders.map(order => (
          <div key={order.id} className="border rounded p-4 shadow">
            <div><strong>Email:</strong> {order.email}</div>
            <div><strong>Status:</strong> {order.paymentStatus}</div>
            <div><strong>Amount:</strong>{' '}
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: order.currency || 'USD',
              }).format((order.amountTotal || 0) / 100)}
            </div>
            <div><strong>Stripe ID:</strong> {order.stripeSessionId}</div>
            <div><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</div>
            <div><strong>Shipping:</strong>
              <select
                value={order.shippingStatus || 'pending'}
                onChange={e => updateStatus(order.id, e.target.value)}
                className="ml-2 border rounded px-2 py-1"
              >
                <option value="pending">Pending</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>

            {/* --- Items breakdown --- */}
            <div className="mt-4">
              <h2 className="font-semibold">Items</h2>
              {order.items.map(item => (
                <div key={item.id} className="ml-4 mt-2 border-t pt-2 text-sm">
                  <div><strong>Artwork:</strong> {item.slug} ({item.size})</div>
                  <div><strong>Line Total:</strong> ${((item.lineTotal ?? 0) / 100).toFixed(2)}</div>
                  <div><strong>Costs:</strong>{' '}
                    print ${(item.printCost ?? 0)/100},{' '}
                    ship ${(item.shippingCost ?? 0)/100},{' '}
                    labor ${(item.laborCost ?? 0)/100},{' '}
                    site ${(item.websiteCost ?? 0)/100}
                  </div>
                  <div><strong>Profit:</strong> ${(item.profit/100).toFixed(2)} →{' '}
                    Artist ${(item.artistShare/100).toFixed(2)} /{' '}
                    Company ${(item.companyShare/100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}