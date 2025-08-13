"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  CartContextType,
  CartItemProductType,
  CartItemType,
  ProductType,
} from "@/types";
import { useUser } from "@/components/contexts/UserProvider";
import { getCartItems, getProducts, updateCartItem } from "@/db/query";
import { AppConfigs } from "@/db";

import { getFinalPrice } from "@/lib/artwork_price";


const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

const CartProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const { currentUser } = useUser();

  const [cartItems, setCartItems] = useState<CartItemType[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("cartItems")
      setCartItems(raw ? JSON.parse(raw) : [])
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cartItems", JSON.stringify(cartItems));
    }
  }, [cartItems])


  const addToCart = (product: CartItemProductType, quantity: number = 1) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: currentUser?._id || "1",
        product,
        quantity,
        operation: "add",
        prev_items: prev,
      }),
    );
      console.log("addToCart()", product.title, "qty:", quantity);
  };


  const updateToCart = (product: CartItemProductType, quantity: number = 1) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: currentUser?._id || "1",
        product,
        quantity,
        operation: "update",
        prev_items: prev,
      }),
    );
  };

  const removeFromCart = (product: CartItemProductType) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: currentUser?._id || "1",
        product,
        operation: "remove",
        prev_items: prev,
      }),
    );
  };

  const calculateProductPrice = (product: CartItemProductType,quantity: number = 1) => {
    return (product.unitPrice ?? 0) * quantity
  }

  const calculateTotalPrice = (cart_items: CartItemType[] = cartItems) => {
    return cart_items.reduce((sum, { product, quantity }) => {
      return sum + calculateProductPrice(product, quantity)
    }, 0)
  };

  const calculateTax = (
    totalPrice: number,
    taxRate: number = parseFloat(`${AppConfigs.sales_tax_rate || 0}`),
  ) => {
    return totalPrice * taxRate;
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateToCart,
        removeFromCart,
        calculateProductPrice,
        calculateTotalPrice,
        calculateTax,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;
