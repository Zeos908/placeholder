"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ActivitySkeleton, PersonRow } from "@/components/friends/rows";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { PersonSummary } from "@/lib/types";

/** Settings → Privacy → Blocked users, each with Unblock (build spec §12). */
export function BlockedView() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["blocked"], queryFn: api.blocked });

  async function unblock(p: PersonSummary) {
    const before = queryClient.getQueryData<PersonSummary[]>(["blocked"]);
    queryClient.setQueryData<PersonSummary[]>(["blocked"], (list) => list?.filter((x) => x.id !== p.id));
    try {
      await api.unblock(p.id);
      toast(`Unblocked @${p.username}`);
      void Promise.all([qk.friends, qk.activity, qk.inbox].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch {
      queryClient.setQueryData(["blocked"], before);
      toast("Couldn't unblock. Try again.");
    }
  }

  if (isPending) return <ActivitySkeleton />;
  if (isError) return <ErrorState message="Couldn't load blocked accounts." onRetry={() => refetch()} />;
  if (!data.length) return <EmptyState icon={Ban} title="No blocked accounts" body="People you block will show up here." />;

  return (
    <ul aria-label="Blocked accounts" className="py-2">
      {data.map((p) => (
        <li key={p.id}>
          <PersonRow
            person={p}
            right={
              <Button variant="surface" size="sm" onClick={() => void unblock(p)}>
                Unblock
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}
