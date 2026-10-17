/**
 * F7: spec §21 test 12 (Settings: Sound effects persists across re-render; the theme toggle sets
 * the `dark` class), plus the F7 check that every §17 empty state is reachable in mock mode
 * (via the "Empty account" preset) and that errors show error states ("Simulate errors").
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { PassedView } from "@/components/saved/PassedView";
import { SettingsView } from "@/components/settings/SettingsView";
import { ShellUserContext, TabActiveContext } from "@/components/shell/shell-context";
import { FeedTab } from "@/components/tabs/FeedTab";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { SavedTab } from "@/components/tabs/SavedTab";
import { api } from "@/lib/api";
import { usePrefs } from "@/lib/store";
import { loadPreset } from "@/mocks/db";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Server actions (Supabase, next/headers) aren't loadable in jsdom.
vi.mock("@/app/(auth)/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/app/actions/profile", () => ({ deleteAccount: vi.fn(async () => ({})), checkUsername: vi.fn() }));

function renderWith(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        <ShellUserContext.Provider value={{ username: "alex", display_name: "Alex Rivera", avatar_url: null }}>
          <TabActiveContext.Provider value={{ tab: "feed", active: true }}>{ui}</TabActiveContext.Provider>
        </ShellUserContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
  return { ...render(tree), rerender: () => render(tree) };
}

beforeEach(() => {
  usePrefs.setState({ soundEnabled: true });
  document.documentElement.className = "";
});

describe("12. settings", () => {
  it("Sound effects stays off after re-render (and in storage)", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWith(<SettingsView />);
    const sound = await screen.findByRole("switch", { name: "Sound effects" });
    expect(sound).toHaveAttribute("aria-checked", "true");
    await user.click(sound);
    expect(JSON.parse(localStorage.getItem("placeholder-prefs")!).state.soundEnabled).toBe(false);

    unmount();
    renderWith(<SettingsView />);
    expect(await screen.findByRole("switch", { name: "Sound effects" })).toHaveAttribute("aria-checked", "false");
  });

  it("the theme toggle sets the dark class and saves the choice", async () => {
    const user = userEvent.setup();
    renderWith(<SettingsView />);
    await user.click(await screen.findByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await user.click(screen.getByRole("radio", { name: "Light" }));
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    await waitFor(async () => expect((await api.me()).theme).toBe("light"));
  });

  it("share my saves persists", async () => {
    const user = userEvent.setup();
    renderWith(<SettingsView />);
    await user.click(await screen.findByRole("switch", { name: /Share my saves/ }));
    await waitFor(async () => expect((await api.me()).share_saves).toBe(false));
  });

  it("is grouped Account · Preferences · Notifications · Privacy, with Sign out and Delete account", async () => {
    renderWith(<SettingsView />);
    for (const name of ["Account", "Preferences", "Notifications", "Privacy"]) {
      expect(await screen.findByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });
});

describe("F7: every empty state is reachable in mock mode", () => {
  beforeEach(() => loadPreset("empty"));

  it.each([
    ["Feed", () => <FeedTab />, "You're all caught up"],
    ["Saved", () => <SavedTab />, "Nothing saved yet"],
    ["Passed", () => <PassedView />, "No passed items"],
    ["Notifications", () => <NotificationsList />, "No notifications"],
  ])("%s", async (_name, ui, title) => {
    renderWith(ui());
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("Activity, Inbox and Friends", async () => {
    const user = userEvent.setup();
    renderWith(<FriendsTab />);
    expect(await screen.findByRole("heading", { name: "No activity yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Inbox/ }));
    expect(await screen.findByRole("heading", { name: "No shares yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Friends/ }));
    expect(await screen.findByRole("heading", { name: "No friends yet" })).toBeInTheDocument();
  });
});

describe("F7: errors show error states, never raw text", () => {
  beforeEach(() => loadPreset("demo", true));

  it.each([
    ["Feed", () => <FeedTab />, "Couldn't load your feed."],
    ["Saved", () => <SavedTab />, "Couldn't load your saved items."],
    ["Notifications", () => <NotificationsList />, "Couldn't load notifications."],
    ["Settings", () => <SettingsView />, "Couldn't load your settings."],
  ])("%s", async (_name, ui, message) => {
    renderWith(ui());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).not.toHaveTextContent(/Simulated outage|503/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("notifications", () => {
  it("accepts a friend request inline", async () => {
    const user = userEvent.setup();
    renderWith(<NotificationsList />);
    await user.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(async () => expect((await api.friends()).friends.some((f) => f.username === "ava")).toBe(true));
    // Answered requests leave the list once it refreshes.
    await waitFor(() => expect(screen.queryByText(/sent you a friend request/)).not.toBeInTheDocument());
  });
});
