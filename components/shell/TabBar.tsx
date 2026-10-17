"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTabNav } from "@/components/shell/useTabNav";
import { useSavedBadge } from "@/lib/badges";
import { useMe } from "@/lib/queries";
import { TABS } from "@/lib/tabs";

/** Mobile bottom tab bar (spec §5): icons only, filled when active, badges on Saved and Friends. */
export function TabBar() {
  const pathname = usePathname();
  const onTab = useTabNav();
  const { data: me } = useMe();
  const dueSoon = useSavedBadge();
  const unreadInbox = me?.badges.unreadInbox ?? 0;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-14 grid-cols-3">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          const badge = tab.key === "saved" && dueSoon > 0 ? dueSoon : null;
          const dot = tab.key === "friends" && unreadInbox > 0;
          const label = [
            tab.label,
            badge ? `${badge} due soon` : null,
            dot ? "new shares" : null,
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                onClick={(e) => onTab(tab, e)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="flex h-full items-center justify-center"
              >
                <span className="relative">
                  <Icon
                    className="size-[26px]"
                    strokeWidth={active ? 2.25 : 1.75}
                    fill={active ? "currentColor" : "none"}
                  />
                  {badge !== null && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white ring-2 ring-background">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  {dot && (
                    <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-danger ring-2 ring-background" />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Space reserved at the bottom of mobile pages so content clears the tab bar. */
export const TAB_BAR_PADDING = "pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0";
