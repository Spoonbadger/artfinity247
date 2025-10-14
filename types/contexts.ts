import {
  CartItemProductType,
  CartItemType,
  ProductType,
  UserType,
} from "@/types/db";
import { type Dispatch, type SetStateAction } from "react";

export type CartContextType = {
  cartItems: CartItemType[];
  addToCart: (product: CartItemProductType, quantity?: number) => void;
  updateToCart: (product: CartItemProductType, quantity?: number) => void;
  removeFromCart: (product: CartItemProductType) => void;
  calculateProductPrice: (
    product: CartItemProductType,
    quantity?: number,
    products?: ProductType[],
  ) => number;
  calculateTotalPrice: (
    cartItems?: CartItemType[],
    products?: ProductType[],
  ) => number;
  calculateTax: (totalPrice: number, taxRate?: number) => number;
};

export type UserContextProps = {
  currentUser: UserType | null;
  setCurrentUser: Dispatch<SetStateAction<UserType | null>>;
  refreshUser: () => Promise<void>;
};

export type LoadingStatusContextProps = {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
};
