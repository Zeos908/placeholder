"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { MiniTile } from "@/components/common/MiniTile";
import { useShellUser } from "@/components/shell/shell-context";
import { api } from "@/lib/api";
import { deadlineInfo } from "@/lib/format";
import { qk } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Desktop right panel (spec §6, ≥ 1160 px): you, "Closing soon" (your saved items due soonest),
 * and "Friends saved" (items friends saved that you haven't swiped), each up to 5.
 */
export function RightPanel() {
  const user = useShellUser();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: qk.rightPanel, queryFn: api.rightPanel, staleTime: 60_000 });

  const invalidate = () =>
    Promise.all(
      [qk.rightPanel, qk.feed, qk.stories, qk.savedAll, qk.me].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  const save = useMutation({
    mutationFn: (listingId: string) => api.swipe(listingId, "right"),
    onSuccess: ({ undoToken }) => {
      invalidate();
      toast("Saved", {
        action: { label: "Undo", onClick: () => api.undoSwipe(undoToken).then(invalidate) },
      });
    },
    onError: () => toast("Couldn't save. Try again."),
  });

  return (
    <aside aria-label="Highlights" className="hidden w-[320px] shrink-0 pt-8 panel:block">
      <div className="flex items-center gap-3">
        <Link href={`/u/${user.username}`} className="rounded-full">
          <Avatar url={user.avatar_url} name={user.display_name || user.username} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${user.username}`} className="block truncate font-semibold">
            {user.username}
          </Link>
          {user.display_name && <p className="truncate text-muted-foreground">{user.display_name}</p>}
        </div>
        <Link href="/settings" className="text-xs font-semibold text-link">
          Switch to settings
        </Link>
      </div>

      {!!data?.closingSoon.length && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold text-muted-foreground">Closing soon</h2>
          <ul className="space-y-3">
            {data.closingSoon.map(({ listing }) => {
              const due = deadlineInfo(listing.deadline);
              return (
                <li key={listing.id}>
                  <Link href={`/saved/${listing.id}`} className="flex items-center gap-3">
                    <MiniTile type={listing.type} size={44} className="rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{listing.title}</span>
                      <span className={cn("text-xs", due.urgent ? "text-danger" : "text-muted-foreground")}>
                        {due.label}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!!data?.friendsSaved.length && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold text-muted-foreground">Friends saved</h2>
          <ul className="space-y-3">
            {data.friendsSaved.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="flex w-11 shrink-0 -space-x-2">
                  {item.people.slice(0, 2).map((p) => (
                    <Avatar
                      key={p.id}
                      url={p.avatar_url}
                      name={p.display_name || p.username}
                      size={28}
                      className="ring-2 ring-background"
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Saved by {item.people[0]?.username}
                    {item.people.length > 1 && ` and ${item.people.length - 1} more`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => save.mutate(item.id)}
                  disabled={save.isPending && save.variables === item.id}
                  className="text-xs font-semibold text-link disabled:opacity-50"
                  aria-label={`Save ${item.title}`}
                >
                  Save
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-xs text-muted-foreground">© 2026 placeholder</p>
    </aside>
  );
}
