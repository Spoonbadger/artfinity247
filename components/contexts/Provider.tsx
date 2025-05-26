"use client";

import { ReactNode } from "react";
import CartProvider from "@/components/contexts/CartProvider";
import UserProvider from "@/components/contexts/UserProvider";
import LoadingStatusProvider from "@/components/contexts/LoadingStatusProvider";

const Provider = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <>
      <LoadingStatusProvider>
        <UserProvider>
          <CartProvider>{children}</CartProvider>
        </UserProvider>
      </LoadingStatusProvider>
    </>
  );
};

export default Provider;
