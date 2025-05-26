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
    // Verify user-session and set current-user
    const loggedInUser = getUser(); // For Development Only

    setCurrentUser(loggedInUser);
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
