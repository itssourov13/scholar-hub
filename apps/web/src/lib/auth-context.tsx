"use client";

import { createContext, useContext } from "react";

export type Role = "student" | "admin";

export type AuthContextValue = {
  userId: string | null;
  role: Role | null;
  /** True only while the configured auth provider resolves the session. */
  loading: boolean;
  /** True while the role is being fetched from /api/profile. */
  roleLoading: boolean;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an auth provider");
  return ctx;
}
