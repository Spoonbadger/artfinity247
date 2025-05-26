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
    const fetchedCartItems = getCartItems({ user_id: currentUser?._id || "1" });

    setCartItems(fetchedCartItems);
  }, [currentUser?._id]);

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

  const calculateProductPrice = (
    product: CartItemProductType,
    quantity: number = 1,
    products: ProductType[] = getProducts(),
  ) => {
    // Find the corresponding product based on the _id
    const matchingProduct = products.find((p) => p._id === product._id);
    if (!matchingProduct) {
      return 0; // Product not found, return 0 price
    }

    // Calculate the base product price
    let productPrice = matchingProduct.price || 0;

    // Add variant prices (if variants exist)
    if (product.variants) {
      product.variants.forEach((variant) => {
        const variantData = matchingProduct.variants?.find(
          (v) => v.type === variant.type,
        );
        if (variantData) {
          const variantPrice =
            variantData.data.find((data) => data.key === variant.key)?.price ||
            0;
          productPrice += variantPrice;
        }
      });
    }

    // Calculate total price
    const totalPrice = productPrice * quantity;
    return totalPrice;
  };

  const calculateTotalPrice = (
    cart_items: CartItemType[] = cartItems,
    products: ProductType[] = getProducts(),
  ) => {
    let totalCartPrice = 0;

    cart_items.forEach((cartItem) => {
      const { product, quantity } = cartItem;
      const itemPrice = calculateProductPrice(product, quantity, products);
      totalCartPrice += itemPrice;
    });

    return totalCartPrice;
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
