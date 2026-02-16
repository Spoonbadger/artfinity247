"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useUser } from "@/components/contexts/UserProvider";
import { CartContextType, CartItemType, CartItemProductType } from "@/types";
import { updateCartItem } from "@/db/query";
import { AppConfigs } from "@/db";

const CartContext = createContext<CartContextType | undefined>(undefined);
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
};

const STORAGE_VERSION = "v1";
const keyFor = (slug?: string) => `cart:${STORAGE_VERSION}:${slug ?? "guest"}`;

function safeParse<T>(raw: string | null): T | [] {
  try {
    return raw ? (JSON.parse(raw) as T) : [];
  } catch {
    return [];
  }
}

const CartProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const { currentUser } = useUser();
  const userKey = keyFor(currentUser?.slug);
  const guestKey = keyFor();

  const [cartItems, setCartItems] = useState<CartItemType[]>([]);
  const loadedKeyRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Load from storage on mount / when the effective key changes
  useEffect(() => {
    const effectiveKey = currentUser?.slug ? userKey : guestKey;
    if (loadedKeyRef.current === effectiveKey) return;

    const fromLS = safeParse<CartItemType[]>(localStorage.getItem(effectiveKey));
    setCartItems(Array.isArray(fromLS) ? fromLS : []);
    loadedKeyRef.current = effectiveKey;
    hasLoadedRef.current = true;
  }, [currentUser?.slug, userKey, guestKey]);

  // If user just logged in, merge guest cart into user cart once
  useEffect(() => {
    if (!currentUser?.slug) return;
    const uKey = userKey;

    const guestRaw = localStorage.getItem(guestKey);
    if (!guestRaw) return;

    const guestItems = safeParse<CartItemType[]>(guestRaw);
    const userItems = safeParse<CartItemType[]>(localStorage.getItem(uKey));
    if (!Array.isArray(guestItems) || guestItems.length === 0) {
      localStorage.removeItem(guestKey);
      return;
    }

    // merge by product id
    const map = new Map<string, CartItemType>();
    [...userItems, ...guestItems].forEach((ci) => {
      const pid = ci.product.id as string;
      const prev = map.get(pid);
      if (prev) {
        map.set(pid, { ...prev, quantity: prev.quantity + ci.quantity });
      } else {
        map.set(pid, ci);
      }
    });

    const merged = Array.from(map.values());
    localStorage.setItem(uKey, JSON.stringify(merged));
    localStorage.removeItem(guestKey);

    // if we’re currently on the user key, reflect merged items in state
    if (loadedKeyRef.current === uKey) setCartItems(merged);
  }, [currentUser?.slug, userKey, guestKey]);

  // Persist to storage whenever items change (but only after initial load)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const effectiveKey = currentUser?.slug ? userKey : guestKey;
    try {
      localStorage.setItem(effectiveKey, JSON.stringify(cartItems));
    } catch {
      // ignore quota errors
    }
  }, [cartItems, currentUser?.slug, userKey, guestKey]);

  // Actions (keep using your updateCartItem helper)
  const addToCart = (product: CartItemProductType, quantity = 1) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: currentUser?.id || "guest",
        product,
        quantity,
        operation: "add",
        prev_items: prev,
      })
    );
  };

  const updateToCart = (product: CartItemProductType, quantity = 1) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: currentUser?.id || "guest",
        product,
        quantity,
        operation: "update",
        prev_items: prev,
      })
    );
  };

  const removeFromCart = (product: CartItemProductType) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: currentUser?.id || "guest",
        product,
        operation: "remove",
        prev_items: prev,
      })
    );
  };

  const calculateProductPrice = (product: CartItemProductType, quantity = 1) =>
    (product.unitPrice ?? 0) * quantity;

  const calculateTotalPrice = (items: CartItemType[] = cartItems) =>
    items.reduce((sum, { product, quantity }) => sum + calculateProductPrice(product, quantity), 0);

  const calculateTax = (totalPrice: number, taxRate = Number(AppConfigs.sales_tax_rate || 0)) =>
    totalPrice * taxRate;

  const clearCart = () => {
    setCartItems([]);
    try {
      localStorage.removeItem(userKey);
      localStorage.removeItem(guestKey);
    } catch {}
    loadedKeyRef.current = currentUser?.slug ? userKey : guestKey;
    hasLoadedRef.current = true;
  }

  const value = useMemo(
    () => ({
      cartItems,
      addToCart,
      updateToCart,
      removeFromCart,
      calculateProductPrice,
      calculateTotalPrice,
      calculateTax,
      clearCart,
    }),
    [
      cartItems, 
      addToCart,
      removeFromCart,
      updateToCart,
      clearCart,
      calculateTotalPrice
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartProvider;
