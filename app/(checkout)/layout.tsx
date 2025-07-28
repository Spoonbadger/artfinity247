'use client'

import { CartProvider, useCart } from '../context/CartContext'
import React from 'react'


const MockCartLoader = () => {
  const { addItem } = useCart()

  React.useEffect(() => {
    addItem({
      id: 'art-123',
      title: 'Test Print',
      price: '250099',
      quantity: 1,
      image: 'https://via.placeholder.com/150',
    })
  }, [])

  return null
}

const CheckoutLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <CartProvider>
      <MockCartLoader />
      <div className="flex flex-row justify-center min-h-screen bg-gray-100">
        <div className="checkout-page p-10 bg-white rounded-lg shadow-md">
          {children}
        </div>
      </div>
    </CartProvider>
  )
}
export default CheckoutLayout