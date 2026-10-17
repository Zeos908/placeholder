/**
 * Spec §21 tests 1–5 (feed) plus the red-dot rules: Friends and bell dots clear once the new
 * items have been seen.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { Feed } from "@/components/feed/Feed";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { ShellUserContext, TabActiveContext } from "@/components/shell/shell-context";
import { FriendsTab } from "@/components/tabs/FriendsTab";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/api";
import { intersect } from "./io-mock";

vi.mock("next/navigation", () => ({
  usePathname: () => "/feed",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderWith(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShellUserContext.Provider value={{ username: "alex", display_name: "Alex Rivera", avatar_url: null }}>
        <TabActiveContext.Provider value={{ tab: "feed", active: true }}>{ui}</TabActiveContext.Provider>
      </ShellUserContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

const posts = () => screen.queryAllByRole("article");
const firstPost = () => posts()[0];
const titleOf = (el: HTMLElement) => el.getAttribute("aria-label")!;

async function renderFeed() {
  const utils = renderWith(<Feed />);
  await waitFor(() => expect(posts().length).toBeGreaterThan(0));
  return utils;
}

describe("feed", () => {
  it("1. renders page 1 and loads page 2 when the 5th-from-last post shows", async () => {
    await renderFeed();
    expect(posts()).toHaveLength(15);

    act(() => intersect(screen.getByTestId("feed-sentinel")));
    await waitFor(() => expect(posts().length).toBeGreaterThan(15));
  });

  it("2. bookmark saves: saved state, toast with Undo, item in Saved", async () => {
    await renderFeed();
    const post = firstPost();
    const title = titleOf(post);
    const bookmark = within(post).getByRole("button", { name: "Save" });

    fireEvent.click(bookmark);
    expect(bookmark).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("button", { name: "Undo" })).toBeInTheDocument();
    await waitFor(async () => expect((await api.saved()).some((s) => s.listing.title === title)).toBe(true));
    // It flies off and leaves the feed.
    await waitFor(() => expect(posts().map(titleOf)).not.toContain(title));
  });

  it("3. Undo restores the post to the feed and removes it from Saved", async () => {
    await renderFeed();
    const title = titleOf(firstPost());
    fireEvent.click(within(firstPost()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(posts().map(titleOf)).not.toContain(title));

    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(titleOf(firstPost())).toBe(title));
    await waitFor(async () => expect((await api.saved()).some((s) => s.listing.title === title)).toBe(false));
  });

  it("4. double-tap on media saves without removing the post", async () => {
    await renderFeed();
    const post = firstPost();
    const title = titleOf(post);
    const media = within(post).getByTestId("post-media");

    fireEvent.click(media);
    fireEvent.click(media);

    await waitFor(() => expect(within(firstPost()).getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(async () => expect((await api.saved()).some((s) => s.listing.title === title)).toBe(true));
    await new Promise((r) => setTimeout(r, 600)); // longer than any fly-off
    expect(titleOf(firstPost())).toBe(title);
  });

  it("5. Pass in the … menu moves the item to Passed; Restore brings it back", async () => {
    const user = userEvent.setup();
    await renderFeed();
    const post = firstPost();
    const title = titleOf(post);

    await user.click(within(post).getByRole("button", { name: "More options" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pass" }));

    await waitFor(() => expect(posts().map(titleOf)).not.toContain(title));
    const passed = await api.passed();
    const item = passed.find((p) => p.listing.title === title);
    expect(item).toBeDefined();

    await api.restore(item!.listing.id);
    expect((await api.passed()).some((p) => p.listing.title === title)).toBe(false);
    expect((await api.feed()).posts.some((p) => p.title === title)).toBe(true);
  });
});

describe("red dots", () => {
  it("the Friends dot clears once new shares have been on screen", async () => {
    expect((await api.me()).badges.unreadInbox).toBeGreaterThan(0);
    renderWith(<FriendsTab />);
    await screen.findByRole("list", { name: "Shares", hidden: true });
    await waitFor(async () => expect((await api.me()).badges.unreadInbox).toBe(0), { timeout: 3000 });
  });

  it("the Friends dot stays while the tab is hidden", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ShellUserContext.Provider value={{ username: "alex", display_name: null, avatar_url: null }}>
        <TabActiveContext.Provider value={{ tab: "friends", active: false }}>
          <FriendsTab />
        </TabActiveContext.Provider>
        </ShellUserContext.Provider>
      </QueryClientProvider>,
    );
    await screen.findByRole("list", { name: "Shares", hidden: true });
    await new Promise((r) => setTimeout(r, 1500));
    expect((await api.me()).badges.unreadInbox).toBeGreaterThan(0);
  });

  it("the bell dot clears once the notifications list has been opened", async () => {
    expect((await api.me()).badges.unreadNotifications).toBeGreaterThan(0);
    renderWith(<NotificationsList />);
    // Section headings depend on the clock (just after midnight nothing is "Today"); wait for rows.
    await screen.findAllByRole("listitem");
    await waitFor(async () => expect((await api.me()).badges.unreadNotifications).toBe(0), { timeout: 3000 });
  });
});
