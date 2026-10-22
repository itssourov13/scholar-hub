"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { AuthContext, type Role } from "@/lib/auth-context";
import { getCurrentRoleState, type StoredRoleState } from "@/lib/auth-role-state";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const userId = user?.id ?? null;
  const [storedRole, setStoredRole] = useState<StoredRoleState>({
    userId: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    if (!isLoaded || !userId) return;

    let active = true;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (active) setStoredRole({ userId, role: (d?.profile?.role as Role) ?? "student", loading: false });
      })
      .catch(() => {
        if (active) setStoredRole({ userId, role: "student", loading: false });
      });

    return () => { active = false; };
  }, [isLoaded, userId]);

  const { role, loading: roleLoading } = getCurrentRoleState(userId, isLoaded, storedRole);

  const signOut = async () => {
    await clerkSignOut();
  };

  return (
    <AuthContext.Provider
      value={{
        userId,
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
