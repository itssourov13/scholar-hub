import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
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

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const cacheRef = useRef<{ token: string | null; at: number } | null>(null);
  const inflightRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") cacheRef.current = null;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      cacheRef.current = null;
      inflightRef.current = null;
    }
  }, [isSignedIn]);

  const resolveToken = useCallback(
    async (opts?: GetTokenOpts) => {
      if (!isSignedIn) return null;

      const now = Date.now();
      const cached = cacheRef.current;
      const fresh = Boolean(cached && now - cached.at < TOKEN_TTL_MS);

      if (opts?.skipCache) {
        cacheRef.current = null;
      } else if (fresh && cached) {
        return cached.token;
      }

      if (inflightRef.current) return inflightRef.current;

      let pending: Promise<string | null>;
      pending = getToken({ skipCache: true })
        .then((token) => {
          // Only a real token is cached. Caching a null — Clerk hiccuping, or a
          // sign-in that hasn't settled — would lock every request out of auth
          // for the whole TTL.
          if (token) cacheRef.current = { token, at: Date.now() };
          return token ?? null;
        })
        .catch((err) => {
          console.error("[api] Clerk getToken failed:", err);
          return null;
        })
        .finally(() => {
          if (inflightRef.current === pending) inflightRef.current = null;
        });

      inflightRef.current = pending;
      return pending;
    },
    [getToken, isSignedIn],
  );

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE,
        getToken: resolveToken,
        getAnonKey,
        fetchImpl: expoFetch as unknown as typeof fetch,
      }),
    [resolveToken],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used within <ApiProvider>.");
  return client;
}
