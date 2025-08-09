'use client'

import { CartProvider, useCart } from '../context/CartContext'
import React from 'react'



const CheckoutLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    // <CartProvider> I think i can delete this next time I see this
      <div className="flex flex-row justify-center min-h-screen bg-gray-100">
        <div className="checkout-page p-10 bg-white rounded-lg shadow-md">
          {children}
        </div>
      </div>
    // </CartProvider>
  )
}
export default CheckoutLayout