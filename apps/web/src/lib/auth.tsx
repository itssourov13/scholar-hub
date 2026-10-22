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
    if (!isLoaded || !user) return;

    let active = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (active) setRole((d?.profile?.role as Role) ?? "student");
      })
      .catch(() => {
        if (active) setRole("student");
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => { active = false; };
  }, [isLoaded, user]);

  const signOut = async () => {
    await clerkSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        userId: user?.id ?? null,
        role: user ? role : null,
        loading: !isLoaded,
        roleLoading: !isLoaded || (Boolean(user) && roleLoading),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
