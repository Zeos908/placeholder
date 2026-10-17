"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { confetti } from "@/lib/confetti";
import { qk, staleTimes } from "@/lib/queries";
import { sound } from "@/lib/sound";
import type { AppStatus, ChecklistItem, ListingDetail, OppType, PassedItem, Reminder, SavedItem } from "@/lib/types";

export type SavedFilter = OppType | "all";

export function useSaved(filter: SavedFilter) {
  return useQuery({
    queryKey: qk.saved(filter),
    queryFn: () => api.saved(filter === "all" ? null : filter),
    staleTime: staleTimes.saved,
  });
}

export function usePassed() {
  return useQuery({ queryKey: qk.passed, queryFn: api.passed });
}

export function useListing(id: string) {
  return useQuery({ queryKey: qk.listing(id), queryFn: () => api.listing(id) });
}

export function prefetchListing(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.prefetchQuery({ queryKey: qk.listing(id), queryFn: () => api.listing(id), staleTime: 30_000 });
}

const COULDNT_SAVE = "Couldn't save. Try again.";

/**
 * Optimistic edits across every place a saved item appears (all Saved filters + its detail),
 * with rollback and the standard toast on failure (spec §17, §19).
 */
function useOptimisticSaved() {
  const queryClient = useQueryClient();

  function snapshot(listingId: string) {
    const lists = queryClient.getQueriesData<SavedItem[]>({ queryKey: qk.savedAll });
    const detail = queryClient.getQueryData<ListingDetail>(qk.listing(listingId));
    return () => {
      for (const [key, data] of lists) queryClient.setQueryData(key, data);
      queryClient.setQueryData(qk.listing(listingId), detail);
    };
  }

  function patchSaved(listingId: string, patch: Partial<Pick<SavedItem, "app_status" | "hidden_from_friends">>) {
    queryClient.setQueriesData<SavedItem[]>({ queryKey: qk.savedAll }, (list) =>
      list?.map((s) => (s.listing.id === listingId ? { ...s, ...patch } : s)),
    );
    queryClient.setQueryData<ListingDetail>(qk.listing(listingId), (d) => (d ? { ...d, ...patch } : d));
  }

  function patchDetail(listingId: string, fn: (d: ListingDetail) => ListingDetail) {
    queryClient.setQueryData<ListingDetail>(qk.listing(listingId), (d) => (d ? fn(d) : d));
  }

  const invalidate = (...keys: QueryKey[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  return { queryClient, snapshot, patchSaved, patchDetail, invalidate };
}

/** Status sheet (spec §12.3). Accepted fires confetti and the chime. */
export function useSetStatus() {
  const o = useOptimisticSaved();
  return useMutation({
    mutationFn: ({ listingId, status }: { listingId: string; status: AppStatus }) =>
      api.updateSaved(listingId, { app_status: status }),
    onMutate: ({ listingId, status }) => {
      const rollback = o.snapshot(listingId);
      o.patchSaved(listingId, { app_status: status });
      if (status === "accepted") {
        confetti();
        sound.accepted();
      }
      return { rollback };
    },
    onError: (_e, _v, ctx) => {
      ctx?.rollback();
      toast(COULDNT_SAVE);
    },
    onSettled: () => o.invalidate(qk.me, qk.rightPanel),
  });
}

export function useHideFromFriends() {
  const o = useOptimisticSaved();
  return useMutation({
    mutationFn: ({ listingId, hidden }: { listingId: string; hidden: boolean }) =>
      api.updateSaved(listingId, { hidden_from_friends: hidden }),
    onMutate: ({ listingId, hidden }) => {
      const rollback = o.snapshot(listingId);
      o.patchSaved(listingId, { hidden_from_friends: hidden });
      return { rollback };
    },
    onError: (_e, _v, ctx) => {
      ctx?.rollback();
      toast(COULDNT_SAVE);
    },
  });
}

/** Unsave → Passed, with an Undo toast that puts it back in Saved (spec §11). */
export function useUnsave() {
  const o = useOptimisticSaved();
  return (item: Pick<SavedItem, "listing">) => {
    const id = item.listing.id;
    sound.pass();
    const rollback = o.snapshot(id);
    o.queryClient.setQueriesData<SavedItem[]>({ queryKey: qk.savedAll }, (list) =>
      list?.filter((s) => s.listing.id !== id),
    );
    const request = api.unsave(id);
    const refresh = () => o.invalidate(qk.savedAll, qk.passed, qk.me, qk.listing(id), qk.rightPanel);
    request.then(refresh, () => {
      rollback();
      toast(COULDNT_SAVE);
    });
    toast("Unsaved", {
      id: "unsave",
      action: {
        label: "Undo",
        onClick: async () => {
          rollback();
          try {
            await api.undoSwipe((await request).undoToken);
          } catch {
            toast("Couldn't undo. Try again.");
          }
          refresh();
        },
      },
    });
    return request;
  };
}

/** Passed → back into the feed pool (deletes the row). */
export function useRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => api.restore(listingId),
    onMutate: (listingId) => {
      const before = queryClient.getQueryData<PassedItem[]>(qk.passed);
      queryClient.setQueryData<PassedItem[]>(qk.passed, (list) => list?.filter((p) => p.listing.id !== listingId));
      return { before };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(qk.passed, ctx?.before);
      toast(COULDNT_SAVE);
    },
    onSuccess: () => {
      toast("Restored to your feed");
      return Promise.all([qk.feed, qk.stories, qk.passed].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}

export function useToggleChecklist(listingId: string) {
  const o = useOptimisticSaved();
  return useMutation({
    mutationFn: (items: ChecklistItem[]) => api.updateChecklist(listingId, items),
    onMutate: (items) => {
      const rollback = o.snapshot(listingId);
      o.patchDetail(listingId, (d) => ({ ...d, checklist: items }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => {
      ctx?.rollback();
      toast(COULDNT_SAVE);
    },
  });
}

export function useAddReminder(listingId: string) {
  const o = useOptimisticSaved();
  return useMutation({
    mutationFn: (body: { remind_at: string; title: string }) => api.createReminder({ listingId, ...body }),
    onMutate: (body) => {
      const rollback = o.snapshot(listingId);
      const temp: Reminder = {
        id: `temp-${Date.now()}`,
        listing_id: listingId,
        remind_at: body.remind_at,
        title: body.title,
        note: null,
        source: "user",
        sent_at: null,
      };
      o.patchDetail(listingId, (d) => ({
        ...d,
        reminders: [...d.reminders, temp].sort((a, b) => a.remind_at.localeCompare(b.remind_at)),
      }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => {
      ctx?.rollback();
      toast(COULDNT_SAVE);
    },
    onSettled: () => o.invalidate(qk.listing(listingId)),
  });
}

export function useDeleteReminder(listingId: string) {
  const o = useOptimisticSaved();
  return useMutation({
    mutationFn: (id: string) => api.deleteReminder(id),
    onMutate: (id) => {
      const rollback = o.snapshot(listingId);
      o.patchDetail(listingId, (d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== id) }));
      return { rollback };
    },
    onError: (_e, _v, ctx) => {
      ctx?.rollback();
      toast(COULDNT_SAVE);
    },
  });
}
