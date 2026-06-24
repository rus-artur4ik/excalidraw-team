import { createContext, useContext, useEffect } from "react";

import { appJotaiStore, useAtomValue } from "../app-jotai";
import {
  getCurrentUserIdToken,
  signInWithGoogle,
  signOutFromApp,
  subscribeToAuthChanges,
} from "../data/firebase";

import { authLoadingAtom, currentUserAtom } from "./atoms";

import type { AppUser } from "../data/firebase";
import type { ReactNode } from "react";

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const user = useAtomValue(currentUserAtom);
  const loading = useAtomValue(authLoadingAtom);

  useEffect(() => {
    return subscribeToAuthChanges((nextUser) => {
      appJotaiStore.set(currentUserAtom, nextUser);
      appJotaiStore.set(authLoadingAtom, false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    signIn: async () => {
      await signInWithGoogle();
    },
    signOut: async () => {
      await signOutFromApp();
    },
    getIdToken: getCurrentUserIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
