import Constants from "expo-constants";

/**
 * Resolves runtime config. Public values come from EXPO_PUBLIC_* env (inlined by
 * Metro) with a fallback to app.json `extra` for the API base.
 */

export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Constants.expoConfig?.extra?.apiBase as string | undefined) ??
  "http://localhost:3000";

export const CLERK_PUBLISHABLE_KEY: string =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!CLERK_PUBLISHABLE_KEY && __DEV__) {
  console.warn(
    "[config] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy .env.example to " +
      ".env.local and add the Clerk publishable key before signing in.",
  );
}
