"use client";

import { Bell, Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/common/Wordmark";
import { useShellUser } from "@/components/shell/shell-context";
import { useTabNav } from "@/components/shell/useTabNav";
import { useSavedBadge } from "@/lib/badges";
import { useMe } from "@/lib/queries";
import { TABS } from "@/lib/tabs";
import { cn } from "@/lib/utils";

/**
 * Desktop sidebar (spec §6): 72 px icons-only at 768–1263 px, 244 px with labels from 1264 px.
 * Active item = filled icon + bold label.
 */
export function Sidebar() {
  const pathname = usePathname();
  const user = useShellUser();
  const onTab = useTabNav();
  const { data: me } = useMe();
  const savedBadge = useSavedBadge();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-border bg-background px-3 pt-8 pb-5 md:flex wide:w-[244px]"
    >
      <Link href="/feed" aria-label="placeholder home" className="mb-8 flex h-10 items-center px-3">
        <Wordmark size={32} short className="wide:hidden" />
        <Wordmark size={32} className="hidden wide:inline" />
      </Link>

      <ul className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const badge = tab.key === "saved" ? savedBadge : 0;
          const dot = tab.key === "friends" && (me?.badges.unreadInbox ?? 0) > 0;
          return (
            <SidebarItem
              key={tab.key}
              href={tab.href}
              label={tab.label}
              icon={tab.icon}
              active={isActive(tab.href)}
              onClick={(e) => onTab(tab, e)}
              badge={badge > 0 ? badge : undefined}
              dot={dot}
            />
          );
        })}
        <SidebarItem
          href="/notifications"
          label="Notifications"
          icon={Bell}
          active={isActive("/notifications")}
          dot={(me?.badges.unreadNotifications ?? 0) > 0}
        />
        <SidebarItem
          href={`/u/${user.username}`}
          label="Profile"
          active={isActive(`/u/${user.username}`)}
          iconNode={(active) => (
            <Avatar
              url={user.avatar_url}
              name={user.display_name || user.username}
              size={26}
              className={cn(active && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
            />
          )}
        />
      </ul>

      <div className="mt-auto">
        <SidebarItem href="/settings" label="More" icon={Menu} active={isActive("/settings")} />
      </div>
    </nav>
  );
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  iconNode,
  active,
  onClick,
  badge,
  dot,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  iconNode?: (active: boolean) => ReactNode;
  active: boolean;
  onClick?: (e: MouseEvent) => void;
  badge?: number;
  dot?: boolean;
}) {
  const a11y = [label, badge ? `${badge} due soon` : null, dot ? "unread" : null].filter(Boolean).join(", ");
  return (
    <li className="list-none">
      <Link
        href={href}
        onClick={onClick}
        aria-label={a11y}
        aria-current={active ? "page" : undefined}
        title={label}
        className="group flex h-12 items-center gap-4 rounded-lg px-3 transition-colors hover:bg-surface"
      >
        <span className="relative flex size-[26px] items-center justify-center transition-transform group-hover:scale-105">
          {iconNode
            ? iconNode(active)
            : Icon && <Icon className="size-[26px]" strokeWidth={active ? 2.25 : 1.75} fill={active ? "currentColor" : "none"} />}
          {badge !== undefined && (
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-bold text-white ring-2 ring-background">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
          {dot && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger ring-2 ring-background" />}
        </span>
        <span className={cn("hidden text-base wide:inline", active && "font-bold")}>{label}</span>
      </Link>
    </li>
  );
}
