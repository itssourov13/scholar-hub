import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { AppState } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { fetch as expoFetch } from "expo/fetch";
import { createApiClient, type ApiClient, type GetTokenOpts } from "@scholarhub/shared";
import { API_BASE } from "./config";
import { getAnonKey } from "./anon-key";

/**
 * Clerk session JWTs last ~60s. The Android app is often backgrounded longer
 * than that; on resume React Query refetches dashboard+roadmap immediately,
 * and Clerk's own getToken cache can still hand back the expired JWT. We keep
 * a shorter in-memory cache, drop it whenever the app leaves the foreground,
 * and always ask Clerk to skip its cache when we actually mint a token.
 */
const TOKEN_TTL_MS = 45_000;

type TokenResolver = {
  resolve: (opts?: GetTokenOpts) => Promise<string | null>;
  invalidate: () => void;
};

/** Create request-time token caching without React refs in render-time factories. */
function createTokenResolver(
  getToken: (opts?: GetTokenOpts) => Promise<string | null>,
  isSignedIn: boolean,
): TokenResolver {
  let cached: { token: string; at: number } | null = null;
  let inflight: Promise<string | null> | null = null;

  const invalidate = () => { cached = null; };

  const resolve = async (opts?: GetTokenOpts): Promise<string | null> => {
    if (!isSignedIn) return null;
    const now = Date.now();
    const fresh = Boolean(cached && now - cached.at < TOKEN_TTL_MS);

    if (opts?.skipCache) invalidate();
    else if (fresh && cached) return cached.token;
    if (inflight) return inflight;

    let pending: Promise<string | null>;
    pending = getToken({ skipCache: true })
      .then((token) => {
        if (token) cached = { token, at: Date.now() };
        return token ?? null;
      })
      .catch((err) => {
        console.error("[api] Clerk getToken failed:", err);
        return null;
      })
      .finally(() => {
        if (inflight === pending) inflight = null;
      });

    inflight = pending;
    return pending;
  };

  return { resolve, invalidate };
}

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const tokenResolver = useMemo(
    () => createTokenResolver(getToken, Boolean(isSignedIn)),
    [getToken, isSignedIn],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") tokenResolver.invalidate();
    });
    return () => sub.remove();
  }, [tokenResolver]);

  const client = useMemo(
    () => createApiClient({
      baseUrl: API_BASE,
      getToken: tokenResolver.resolve,
      getAnonKey,
      fetchImpl: expoFetch as unknown as typeof fetch,
    }),
    [tokenResolver],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used within <ApiProvider>.");
  return client;
}
