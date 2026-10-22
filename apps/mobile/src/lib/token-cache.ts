import * as SecureStore from "expo-secure-store";

interface TokenCache {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

/**
 * Persists Clerk's session JWT in the device keychain / keystore so a signed-in
 * user stays signed in across launches. Used as `<ClerkProvider tokenCache>`.
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.error("[token-cache] getToken failed:", err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error("[token-cache] saveToken failed:", err);
    }
  },
};
