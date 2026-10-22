"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { AuthContext, type Role } from "@/lib/auth-context";

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
