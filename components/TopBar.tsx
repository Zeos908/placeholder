import Link from "next/link";
import { Avatar } from "@/components/Avatar";

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
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur">
      <Link href="/feed" className="text-accent-gradient text-2xl font-bold tracking-tight">
        placeholder
      </Link>
      <Link
        href="/settings"
        aria-label="Settings and profile"
        className="rounded-full focus-visible:ring-2 focus-visible:ring-accent-2 focus-visible:outline-none"
      >
        <Avatar url={avatarUrl} name={displayName || username} size={30} />
      </Link>
    </header>
  );
}
