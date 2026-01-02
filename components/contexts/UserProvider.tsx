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
  const [loading, setLoading] = useState(true);


  // 🔄 helper: refresh user from /api/auth/me
  async function refreshUser() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      setCurrentUser(data.user ?? null);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }

  // initial fetch
  useEffect(() => {
    refreshUser();
  }, []);

  // inside UserProvider, just before return (
console.log("UserProvider render", {
  loading,
  currentUser,
  role: currentUser?.role,
});


  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, refreshUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider
