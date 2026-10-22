import * as SecureStore from "expo-secure-store";

/**
 * A stable per-install identifier used as the `x-anon-key` header for the
 * anonymous chat trial (mirrors the web client's anon rate-limit bucket).
 * Generated once, then cached in secure storage.
 */
const ANON_KEY_STORAGE = "bp_anon_key";

let cached: string | null = null;

function randomKey(): string {
  // Not security-sensitive — just a stable bucket id. Good enough entropy.
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getAnonKey(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await SecureStore.getItemAsync(ANON_KEY_STORAGE);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = randomKey();
    await SecureStore.setItemAsync(ANON_KEY_STORAGE, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // Storage unavailable — fall back to an in-memory key for this session.
    cached = cached ?? randomKey();
    return cached;
  }
}
