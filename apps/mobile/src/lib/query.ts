import { useAuth } from "@clerk/clerk-expo";
import {
  QueryClient,
  useQuery,
  type DefaultError,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { ApiError } from "@scholarhub/shared";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401 is retried once inside the API client with a fresh Clerk JWT.
      // A second query-level retry would just replay the same unauthenticated
      // burst (the 2× dashboard + 2× roadmap pattern in production logs).
      retry: (count, error) => {
        if (error instanceof ApiError && error.status === 401) return false;
        return count < 1;
      },
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function useSignedIn(): boolean {
  const { isLoaded, isSignedIn } = useAuth();
  return Boolean(isLoaded && isSignedIn);
}

/** Like useQuery, but idle until Clerk reports a signed-in session. */
export function useSignedInQuery<
  TQueryFnData,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  const signedIn = useSignedIn();
  return useQuery({
    ...options,
    enabled: signedIn && (options.enabled ?? true),
  });
}
