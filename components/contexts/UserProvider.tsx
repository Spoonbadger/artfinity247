"use client";

import React, {
  ReactNode,
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import { UserType, UserContextProps } from "@/types";

const UserContext = createContext<UserContextProps | null>(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};

export const UserProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  // 🔄 helper: refresh user from /api/auth/me
  async function refreshUser() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (data.user) setCurrentUser(data.user);
      else setCurrentUser(null);
    } catch (err) {
      console.error("Failed to refresh user:", err);
      setCurrentUser(null);
    }
  }

  // initial fetch
  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider
