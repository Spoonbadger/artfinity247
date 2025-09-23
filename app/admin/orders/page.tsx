'use client'

import { useEffect, useState } from 'react'

type Order = {
  id: string,
  stripeSessionId: string,
  email: string | null,
  amountTotal: number | null,
  currency: string | null,
  paymentStatus: string,
  createdAt: string,
  shippingStatus: string,
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])

    useEffect(() => {
        fetch('/api/orders')
        .then(res => res.json())
        .then(setOrders)
    }, [])

    const updateStatus = async (orderId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shippingStatus: newStatus }),
            })
            if (!res.ok) throw new Error("Failed to update")
            setOrders(prev =>
            prev.map(o =>
                o.id === orderId ? { ...o, shippingStatus: newStatus } : o
            )
            )
        } catch (err) {
            console.error(err)
            alert("Could not update shipping status")
        }
      }

    return (
        <div className="p-6">
            <h1 className='text-2xl font-bold mb-4'>Admin Orders View</h1>
            <div className='space-y-2'>
                {orders.map(order => (
                    <div key={order.id} className='border rounded p-4 shadow'>
                        <div><strong>Email:</strong> {order.email}</div>
                        <div><strong>Status:</strong> {order.paymentStatus}</div>
                        <div><strong>Amount:</strong>{" "}
                            {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: order.currency || "USD",
                            }).format((order.amountTotal || 0) / 100)}
                        </div>
                        <div><strong>Stripe ID:</strong> {order.stripeSessionId}</div>
                        <div><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</div>
                        <div><strong>Shipping:</strong>
                        <select
                            value={order.shippingStatus || "pending"}
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            className="ml-2 border rounded px-2 py-1"
                        >
                            <option value="pending">Pending</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                        </select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}