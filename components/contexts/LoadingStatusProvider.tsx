"use client";

import React, {
  ReactNode,
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import { LoadingStatusContextProps } from "@/types";

const LoadingStatusContext = createContext<LoadingStatusContextProps | null>(
  null,
);

export const useLoadingStatus = () => {
  const context = useContext(LoadingStatusContext);
  if (!context) {
    throw new Error(
      "useLoadingStatus must be used within a LoadingStatusProvider",
    );
  }
  return context;
};

const LoadingStatusProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactNode => {
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  return (
    <LoadingStatusContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
    </LoadingStatusContext.Provider>
  );
};

export default LoadingStatusProvider;
