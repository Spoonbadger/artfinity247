'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

type CartItem = {
    id: string,
    title: string,
    price: string,
    quantity: number,
    image?: string
}

type CartContextType = {
    items: CartItem[],
    addItem: (item: CartItem) => void
    removeItem: (id: string) => void
    clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [items, setItems] = useState<CartItem[]>([])

    const addItem = (item: CartItem) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.id === item.id)
            if (existing) {
                return prev.map((i) => 
                    i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
                )
            }
            return [...prev, item]
        })
    }

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((i) => i.id !== id))
    }

    const clearCart = () => setItems([])


    return (
        <CartContext.Provider value={{ items, addItem, removeItem, clearCart }}>
            {children}
        </CartContext.Provider>
    )
}

export const useCart = () => {
    const context = useContext(CartContext)
    if (!context) {
        throw new Error('useCart must be used within a CartProvider')
    }
    return context
}