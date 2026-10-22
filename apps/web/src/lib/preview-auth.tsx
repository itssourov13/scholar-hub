"use client";

import { AuthContext } from "@/lib/auth-context";

/**
 * Guest-only auth context for an explicitly enabled local visual preview.
 * It never authenticates users or grants API access; API handlers continue to
 * enforce their own authentication and authorization requirements.
 */
export function PreviewAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        userId: null,
        role: null,
        loading: false,
        roleLoading: false,
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
