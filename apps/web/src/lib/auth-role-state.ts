import type { Role } from "@/lib/auth-context";

export type StoredRoleState = {
  userId: string | null;
  role: Role | null;
  loading: boolean;
};

export type CurrentRoleState = {
  role: Role | null;
  loading: boolean;
};

/** Return a role only when it belongs to the currently authenticated user. */
export function getCurrentRoleState(
  userId: string | null,
  authLoaded: boolean,
  stored: StoredRoleState,
): CurrentRoleState {
  if (!authLoaded) return { role: null, loading: true };
  if (!userId) return { role: null, loading: false };
  if (stored.userId !== userId) return { role: null, loading: true };
  return { role: stored.role, loading: stored.loading };
}
