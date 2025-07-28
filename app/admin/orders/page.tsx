'use client'

import { useEffect, useState } from 'react'

type Order = {
  id: string,
  stripeSessionId: string,
  email: string | null,
  amountTotal: number | null,
  currency: string | null,
  paymentStatus: string,
  createdAt: string
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])

    useEffect(() => {
        fetch('/api/orders')
        .then(res => res.json())
        .then(setOrders)
    }, [])

    return (
        <div className="p-6">
            <h1 className='text-2xl font-bold mb-4'>Admin Orders View</h1>
            <div className='space-y-2'>
                {orders.map(order => (
                    <div key={order.id} className='border rounded p-4 shadow'>
                        <div><strong>Email:</strong> {order.email}</div>
                        <div><strong>Status:</strong> {order.paymentStatus}</div>
                        <div><strong>Amount:</strong> {order.amountTotal} {order.currency}</div>
                        <div><strong>Stripe ID:</strong> {order.stripeSessionId}</div>
                        <div><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}