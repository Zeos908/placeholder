"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/common/Wordmark";
import { useShellUser } from "@/components/shell/shell-context";
import { useMe } from "@/lib/queries";
import { useUi } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Mobile top bar (spec §5): shown on Feed, Friends and Saved; hides on scroll down. */
export function TopBar() {
  const user = useShellUser();
  const { data: me } = useMe();
  const visible = useUi((s) => s.topBarVisible);
  const unread = (me?.badges.unreadNotifications ?? 0) > 0;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background transition-transform duration-200 ease-ig md:hidden",
        !visible && "-translate-y-full",
      )}
    >
      <div className="flex h-full items-center justify-between px-4">
        <Link href="/feed" aria-label="placeholder home">
          <Wordmark size={30} />
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/search" aria-label="Search">
            <Search className="size-6" strokeWidth={1.75} />
          </Link>
          <Link
            href="/notifications"
            aria-label={unread ? "Notifications (unread)" : "Notifications"}
            className="relative"
          >
            <Bell className="size-6" strokeWidth={1.75} />
            {unread && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger ring-2 ring-background" />
            )}
          </Link>
          <Link href={`/u/${user.username}`} aria-label="Your profile" className="rounded-full">
            <Avatar url={user.avatar_url} name={user.display_name || user.username} size={28} />
          </Link>
        </div>
      </div>
    </header>
  );
}
