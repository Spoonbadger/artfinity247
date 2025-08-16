"use client";

import React, {
  ReactNode,
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import { UserType } from "@/types";
import { UserContextProps } from "@/types";
import { getUser } from "@/db/query";

const UserContext = createContext<UserContextProps | null>(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactNode => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token =
          (typeof window !== 'undefined' && (sessionStorage.getItem('token') || localStorage.getItem('token')))
          || null
        if (!token) return

        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) {
          // stale token, clean up both
          sessionStorage.removeItem('token')
          localStorage.removeItem('token')
          return
        }
        const data = await res.json()
        setCurrentUser(data)
      } catch {
        setCurrentUser(null)
      }
    }
    fetchUser()
  }, [])


  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
