import { describe, expect, it } from "vitest";
import { getCurrentRoleState, type StoredRoleState } from "@/lib/auth-role-state";

const aliceAdmin: StoredRoleState = { userId: "user_alice", role: "admin", loading: false };

describe("getCurrentRoleState", () => {
  it("does not expose the previous user's role while a different user's role is loading", () => {
    expect(getCurrentRoleState("user_bob", true, aliceAdmin)).toEqual({ role: null, loading: true });
  });

  it("returns the stored role only for the user it belongs to", () => {
    expect(getCurrentRoleState("user_alice", true, aliceAdmin)).toEqual({ role: "admin", loading: false });
  });

  it("clears role state when signed out", () => {
    expect(getCurrentRoleState(null, true, aliceAdmin)).toEqual({ role: null, loading: false });
  });

  it("hides role data while the auth provider is not loaded", () => {
    expect(getCurrentRoleState("user_alice", false, aliceAdmin)).toEqual({ role: null, loading: true });
  });
});
