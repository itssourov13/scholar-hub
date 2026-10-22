import Constants from "expo-constants";

/**
 * Resolves runtime config. Public values come from EXPO_PUBLIC_* env (inlined by
 * Metro) with a fallback to app.json `extra` for the API base.
 */

const configuredApiBase =
  process.env.EXPO_PUBLIC_API_BASE?.trim() ||
  (Constants.expoConfig?.extra?.apiBase as string | undefined)?.trim();

// Android emulators reach the development host through 10.0.2.2, not localhost.
// Production must supply the actual deployed API origin via EXPO_PUBLIC_API_BASE.
export const API_BASE: string = configuredApiBase
  ? configuredApiBase.replace(/\/+$/, "")
  : __DEV__
    ? "http://10.0.2.2:3000"
    : "";

if (!API_BASE && !__DEV__) {
  console.error("[config] EXPO_PUBLIC_API_BASE is missing. Configure the deployed ScholarHub API URL in the build environment.");
}

export const CLERK_PUBLISHABLE_KEY: string =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!CLERK_PUBLISHABLE_KEY && __DEV__) {
  console.warn(
    "[config] EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Copy .env.example to " +
      ".env.local and add the Clerk publishable key before signing in.",
  );
}
