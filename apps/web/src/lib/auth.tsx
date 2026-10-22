"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useState } from "react";

type Role = "student" | "admin";

type AuthContextValue = {
  userId: string | null;
  role: Role | null;
  /** True only while Clerk resolves the auth session. Does NOT wait on the
   *  background /api/profile role fetch, so auth-aware UI (e.g. the navbar)
   *  renders instantly instead of blocking on a cold Neon database. */
  loading: boolean;
  /** True while the role is still being fetched from /api/profile. Only
   *  consumers that actually need the role (e.g. AdminGuard) should gate on this. */
  roleLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setRole(null);
      setRoleLoading(false);
      return;
    }

    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setRole((d?.profile?.role as Role) ?? "student");
      })
      .catch(() => setRole("student"))
      .finally(() => setRoleLoading(false));
  }, [isLoaded, user]);

  const signOut = async () => {
    await clerkSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        userId: user?.id ?? null,
        role,
        loading: !isLoaded,
        roleLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
