'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Order = {
    id: string,
    createdAt: string
}


const ThankYouPage = () => {
    const searchParams = useSearchParams()
    const sessionId = searchParams.get('session_id')
    const [order, setOrder] = useState<Order | null>(null)

    useEffect(() => {
        if (!sessionId) return

        fetch(`/api/thank-you?session_id=${sessionId}`)
        .then(res => res.json())
        .then(setOrder)
    }, [sessionId])

    return (
        <div className='p-6 text-center'>
            <h1 className='text-2xl font-bold mb-4'>Thank you for your order!</h1>
            {order ? (
                <p>your confirmation code is <strong>{order.id}</strong></p> ) : (
                <p>Loading your confirmation...</p>
            )}
        </div>
    )
}

export default ThankYouPage