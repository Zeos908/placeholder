import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/common/Wordmark";

/** §9.1 top bar. The notifications bell joins in Phase 9. */
export function TopBar({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
      <Link href="/feed" aria-label="placeholder home">
        <Wordmark size={30} />
      </Link>
      <Link
        href="/settings"
        aria-label="Settings and profile"
        className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Avatar url={avatarUrl} name={displayName || username} size={30} />
      </Link>
    </header>
  );
}
