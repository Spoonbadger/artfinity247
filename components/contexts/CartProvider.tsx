"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { useUser } from "@/components/contexts/UserProvider";
import { CartContextType, CartItemType, CartItemProductType } from "@/types";
import { updateCartItem } from "@/db/query";
import { AppConfigs } from "@/db";

// Browser storage can throw (blocked site data, some private modes). The cart then just doesn't persist; the page keeps working.
const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  remove(k: string) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};

// updateCartItem mutates the items it is given; hand it copies so state updaters stay pure
// (React runs updaters twice in dev, which used to double quantities).
const clone = (items: CartItemType[]) => items.map((ci) => ({ ...ci }));

const CartContext = createContext<CartContextType | undefined>(undefined);
export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
};

const STORAGE_VERSION = "v1";
const keyFor = (slug?: string) => `cart:${STORAGE_VERSION}:${slug ?? "guest"}`;

const calculateProductPrice = (product: CartItemProductType, quantity = 1) => (product.unitPrice ?? 0) * quantity;

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

    const fromLS = safeParse<CartItemType[]>(store.get(effectiveKey));
    setCartItems(Array.isArray(fromLS) ? fromLS : []);
    loadedKeyRef.current = effectiveKey;
    hasLoadedRef.current = true;
  }, [currentUser?.slug, userKey, guestKey]);

  // If user just logged in, merge guest cart into user cart once
  useEffect(() => {
    if (!currentUser?.slug) return;
    const uKey = userKey;

    const guestRaw = store.get(guestKey);
    if (!guestRaw) return;

    const guestItems = safeParse<CartItemType[]>(guestRaw);
    const userItems = safeParse<CartItemType[]>(store.get(uKey));
    if (!Array.isArray(guestItems) || guestItems.length === 0) {
      store.remove(guestKey);
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
    store.set(uKey, JSON.stringify(merged));
    store.remove(guestKey);

    // if we’re currently on the user key, reflect merged items in state
    if (loadedKeyRef.current === uKey) setCartItems(merged);
  }, [currentUser?.slug, userKey, guestKey]);

  // Persist to storage whenever items change (but only after initial load)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const effectiveKey = currentUser?.slug ? userKey : guestKey;
    try {
      store.set(effectiveKey, JSON.stringify(cartItems));
    } catch {
      // ignore quota errors
    }
  }, [cartItems, currentUser?.slug, userKey, guestKey]);

  // Actions (keep using your updateCartItem helper). useCallback keeps them stable, so the context value below only
  // changes when the cart or the signed-in user does, not on every render (every useCart() would re-render).
  const userId = currentUser?.id || "guest";
  const addToCart = useCallback((product: CartItemProductType, quantity = 1) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: userId,
        product,
        quantity,
        operation: "add",
        prev_items: clone(prev),
      })
    );
  }, [userId]);

  const updateToCart = useCallback((product: CartItemProductType, quantity = 1) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: userId,
        product,
        quantity,
        operation: "update",
        prev_items: clone(prev),
      })
    );
  }, [userId]);

  const removeFromCart = useCallback((product: CartItemProductType) => {
    setCartItems((prev) =>
      updateCartItem({
        user_id: userId,
        product,
        operation: "remove",
        prev_items: clone(prev),
      })
    );
  }, [userId]);

  const calculateTotalPrice = useCallback(
    (items: CartItemType[] = cartItems) => items.reduce((sum, { product, quantity }) => sum + calculateProductPrice(product, quantity), 0),
    [cartItems],
  );

  const calculateTax = (totalPrice: number, taxRate = Number(AppConfigs.sales_tax_rate || 0)) =>
    totalPrice * taxRate;

  const clearCart = useCallback(() => {
    setCartItems([]);
    try {
      store.remove(userKey);
      store.remove(guestKey);
    } catch {}
    loadedKeyRef.current = currentUser?.slug ? userKey : guestKey;
    hasLoadedRef.current = true;
  }, [currentUser?.slug, userKey, guestKey]);

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
    [cartItems, addToCart, removeFromCart, updateToCart, clearCart, calculateTotalPrice],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartProvider;
