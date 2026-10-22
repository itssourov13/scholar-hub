import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/api";
import { useSignedInQuery } from "@/lib/query";

const KEY = ["bookmarks"] as const;

/**
 * Shared bookmark state backed by `/api/bookmarks`. Exposes the set of bookmarked
 * scholarship ids plus an optimistic `toggle`. Used by scholarship cards, the
 * detail screen, and the Bookmarks list so they stay in sync.
 */
export function useBookmarks() {
  const api = useApi();
  const qc = useQueryClient();

  const { data } = useSignedInQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.getBookmarks();
      return new Set(res.bookmarks.map((b) => b.scholarship_id));
    },
    staleTime: 30_000,
  });

  const ids = data ?? new Set<string>();

  const mutation = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (on) await api.addBookmark(id);
      else await api.removeBookmark(id);
    },
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Set<string>>(KEY) ?? new Set<string>();
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      qc.setQueryData(KEY, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const toggle = useCallback(
    (id: string) => mutation.mutate({ id, on: !ids.has(id) }),
    [ids, mutation],
  );

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return { ids, has, toggle, count: ids.size };
}
