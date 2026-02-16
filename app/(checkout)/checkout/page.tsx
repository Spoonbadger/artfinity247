'use client'

import { loadStripe } from '@stripe/stripe-js'
import { useCart } from '@/components/contexts'
import { useUser } from '@/components/contexts'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function CheckoutPage() {
  const { cartItems } = useCart()            // ← was items
  const { currentUser } = useUser()

  const handleCheckout = async () => {
    // Build the payload your API expects (slug, size, qty)
    const items = cartItems.map(ci => ({
      slug: ci.product.slug,
      selectedSize: ci.product.selectedSize,
      quantity: ci.quantity,
    }))

    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        buyer: { id: currentUser?.id, email: currentUser?.email },
      }),
    })

    // if (!res.ok) {
    //   console.error('Failed to create session', await res.text())
    //   return
    // }

    const { url } = await res.json()
    if (url) window.location.href = url
  }

  return (
    <div className="p-10 bg-white rounded-lg shadow-md">
      <h1 className="text-xl font-bold mb-4">Order summary</h1>

      {cartItems.map(ci => (
        <div key={`${ci.product.slug}-${ci.product.selectedSize}`}>
          <p>{ci.product.title} — {ci.product.selectedSize} × {ci.quantity}</p>
        </div>
      ))}

      <button onClick={handleCheckout} className="mt-4 bg-black text-white p-2 rounded">
        Proceed to Payment
      </button>
    </div>
  )
}
