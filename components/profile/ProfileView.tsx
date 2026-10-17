"use client";

import { Ban, ChevronDown, Flag, Grid3x3, MoreHorizontal, Settings } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PostSheet } from "@/components/common/PostSheet";
import { ReportDialog } from "@/components/common/ReportDialog";
import { ShareSavedSheet } from "@/components/friends/ShareSavedSheet";
import { GridTile } from "@/components/profile/GridTile";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useFriendActions, useProfile } from "@/lib/friends";
import { gradeLabel } from "@/lib/format";
import { tagLabel, type Tag } from "@/lib/tags";
import type { PublicProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Profile page for you or anyone else (spec §14). */
export function ProfileView() {
  const { username } = useParams<{ username: string }>();
  const name = decodeURIComponent(username);
  const router = useRouter();
  const { data, isPending, isError, refetch } = useProfile(name);
  const [postId, setPostId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const actions = useFriendActions();

  const self = data?.relationship === "self";
  const menu = data ? (
    self ? (
      <Link href="/settings" aria-label="Settings" className="flex size-10 items-center justify-center rounded-full hover:bg-surface">
        <Settings className="size-6" />
      </Link>
    ) : (
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="More options" className="flex size-10 items-center justify-center rounded-full hover:bg-surface">
          <MoreHorizontal className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem variant="destructive" onSelect={() => setBlockOpen(true)}>
            <Ban /> Block
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setReportOpen(true)}>
            <Flag /> Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  ) : null;

  return (
    <div className="mx-auto max-w-[935px] pb-6">
      <PageHeader title={data?.username ?? name} right={menu} />
      {isPending ? (
        <ProfileSkeleton />
      ) : isError || !data ? (
        <ErrorState message="This profile isn't available." onRetry={() => refetch()} />
      ) : (
        <>
          <ProfileHeader profile={data} />
          <section aria-label="Saved opportunities" className="mt-4 border-t border-border">
            <div className="flex h-11 items-center justify-center gap-1.5 border-t-2 border-foreground text-xs font-semibold tracking-wide uppercase md:w-fit md:mx-auto md:px-4">
              <Grid3x3 className="size-3.5" /> Saved
            </div>
            {data.saves.length === 0 ? (
              <EmptyState
                icon={Grid3x3}
                title={self ? "Nothing saved yet" : "No saved opportunities to show."}
                body={
                  self
                    ? "Swipe right or double-tap a post to save it."
                    : data.relationship === "friend"
                      ? undefined
                      : `Add @${data.username} as a friend to see what they save.`
                }
              />
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {data.saves.map((item) => (
                  <GridTile key={item.id} item={item} onOpen={() => setPostId(item.id)} />
                ))}
              </div>
            )}
          </section>

          <PostSheet listingId={postId} onClose={() => setPostId(null)} />
          {!self && (
            <>
              <ReportDialog
                open={reportOpen}
                onOpenChange={setReportOpen}
                targetType="user"
                targetId={data.id}
                targetName={`@${data.username}`}
              />
              <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
                <DialogContent className="max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Block @{data.username}?</DialogTitle>
                    <DialogDescription>
                      You&apos;ll stop being friends. They won&apos;t be able to find you, see your activity, or send you
                      anything. You can unblock them in Settings.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setBlockOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        setBlockOpen(false);
                        await actions.block(data.username, data.id);
                        router.push("/friends");
                      }}
                    >
                      Block
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const school = [profile.school, gradeLabel(profile.grade_level)].filter(Boolean).join(" · ");
  return (
    <div className="px-4 pt-4 md:flex md:gap-16 md:px-10 md:pt-8">
      <div className="flex items-center gap-6 md:block">
        <Avatar
          url={profile.avatar_url}
          name={profile.display_name || profile.username}
          size={86}
          className="md:hidden"
        />
        <Avatar
          url={profile.avatar_url}
          name={profile.display_name || profile.username}
          size={150}
          className="hidden md:block"
        />
        <Counts profile={profile} className="flex-1 md:hidden" />
      </div>
      <div className="mt-3 min-w-0 flex-1 space-y-1 md:mt-0">
        <div className="hidden items-center gap-4 md:flex">
          <h2 className="text-xl">{profile.username}</h2>
          <RelationshipButtons profile={profile} compact />
        </div>
        <Counts profile={profile} className="hidden max-w-sm md:flex md:py-3" />
        {profile.display_name && <p className="font-semibold">{profile.display_name}</p>}
        <p className="text-muted-foreground md:hidden">@{profile.username}</p>
        {school && <p>{school}</p>}
        {profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>}
        {profile.interests.length > 0 && (
          <ul aria-label="Interests" className="flex flex-wrap gap-1.5 pt-1.5">
            {profile.interests.map((t) => (
              <li key={t} className="rounded-full bg-surface px-2.5 py-1 text-xs">
                {tagLabel(t as Tag)}
              </li>
            ))}
          </ul>
        )}
        <div className="pt-3 md:hidden">
          <RelationshipButtons profile={profile} />
        </div>
      </div>
    </div>
  );
}

function Counts({ profile, className }: { profile: PublicProfile; className?: string }) {
  const items = [
    { label: "Saved", value: profile.counts.saved },
    { label: "Applied", value: profile.counts.applied },
    { label: "Friends", value: profile.counts.friends },
  ];
  return (
    <dl className={cn("flex justify-around text-center md:justify-start md:gap-10 md:text-left", className)}>
      {items.map((c) => (
        <div key={c.label} className="flex flex-col-reverse md:flex-row md:gap-1.5">
          <dt className="text-[13px] md:text-base">{c.label}</dt>
          <dd className="text-base font-bold">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelationshipButtons({ profile, compact }: { profile: PublicProfile; compact?: boolean }) {
  const actions = useFriendActions();
  const [shareOpen, setShareOpen] = useState(false);
  const cls = compact ? "h-8 px-4" : "h-8 flex-1";
  const wrap = compact ? "flex gap-2" : "flex gap-2";

  async function shareProfile() {
    const url = `${location.origin}/u/${profile.username}`;
    if (navigator.share) {
      await navigator.share({ title: `@${profile.username} on placeholder`, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Profile link copied");
    } catch {
      toast("Couldn't copy the link.");
    }
  }

  switch (profile.relationship) {
    case "self":
      return (
        <div className={wrap}>
          <Button asChild variant="surface" className={cls}>
            <Link href="/settings">Edit profile</Link>
          </Button>
          <Button variant="surface" className={cls} onClick={shareProfile}>
            Share profile
          </Button>
        </div>
      );
    case "friend":
      return (
        <div className={wrap}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="surface" className={cls}>
                Friends <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => void actions.unfriend(profile.username, profile.id)}
              >
                Unfriend
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="surface" className={cls} onClick={() => setShareOpen(true)}>
            Share
          </Button>
          <ShareSavedSheet friend={profile} open={shareOpen} onOpenChange={setShareOpen} />
        </div>
      );
    case "requested":
      return (
        <div className={wrap}>
          <Button variant="surface" className={cls} disabled>
            Requested
          </Button>
        </div>
      );
    case "incoming":
      return (
        <div className={wrap}>
          <Button variant="gradient" className={cls} onClick={() => void actions.accept(profile.username, profile.id)}>
            Accept
          </Button>
          <Button variant="surface" className={cls} onClick={() => void actions.decline(profile.username, profile.id)}>
            Decline
          </Button>
        </div>
      );
    default:
      return (
        <div className={wrap}>
          <Button variant="gradient" className={cls} onClick={() => void actions.request(profile.username, profile.id)}>
            Add friend
          </Button>
        </div>
      );
  }
}

/** Spec §8: header (circle + 3 count blocks + 2 bars) + 9 grid squares. */
function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile">
      <div className="flex items-center gap-6 px-4 pt-4" aria-hidden>
        <Skeleton className="size-[86px] shrink-0 rounded-full" />
        <div className="flex flex-1 justify-around">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 px-4 pt-4" aria-hidden>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="mt-6 grid grid-cols-3 gap-0.5" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    </div>
  );
}
