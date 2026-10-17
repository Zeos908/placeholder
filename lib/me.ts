"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api, type MeUpdate } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { Me } from "@/lib/types";

/**
 * PATCH /api/me with an optimistic update of ['me'] and rollback. Callers that show field
 * errors (Edit profile) pass `quiet` and read `error.code`/`message` themselves.
 */
export function useUpdateMe({ quiet = false } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: MeUpdate) => api.updateMe(patch),
    onMutate: (patch) => {
      const before = queryClient.getQueryData<Me>(qk.me);
      queryClient.setQueryData<Me>(qk.me, (me) => (me ? ({ ...me, ...patch } as Me) : me));
      return { before };
    },
    onError: (_e, _p, ctx) => {
      queryClient.setQueryData(qk.me, ctx?.before);
      if (!quiet) toast("Couldn't save. Try again.");
    },
    onSuccess: (me) => {
      queryClient.setQueryData(qk.me, me);
      // Username / photo / profile fields show up on your profile page and in the shell.
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

/** Field name for an /api/me validation error (username, zip, …), if the server named one. */
export function errorField(e: unknown): string | undefined {
  if (!(e instanceof ApiError)) return undefined;
  if (e.code === "username_taken") return "username";
  return e.code;
}
