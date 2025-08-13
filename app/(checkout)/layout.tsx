'use client'

import { CartProvider, useCart } from '../context/CartContext'
import React from 'react'


const CheckoutLayout = ({ children }: { children: React.ReactNode }) => {
  return (
      <div className="flex flex-row justify-center min-h-screen bg-gray-100">
        <div className="checkout-page p-10 bg-white rounded-lg shadow-md">
          {children}
        </div>
      </div>
  )
}
export default CheckoutLayout